// src/materializer_actions.ts
import "source-map-support/register.js";
import fetch from "node-fetch";
import { createConsumer, TOPICS } from "./kafka.js";
import { pool, ensureDbConnection, runTransactionWithRetries } from "./postgres.js";
import { config } from "./config.js";
import { QUERIES } from "./queries.js";

const LOG_PREFIX = `[${config.materializer.name}-actions]`;

/**
 * Topic / event type handled:
 * - topic: TOPICS.HUMAN_RESPONSES
 * - messages expected to have shape: { event_id, eventType: "human_action", context_id, action, actor, notes, timestamp }
 */

/* ---------- Helpers ---------- */
function safeParseJson(s: Buffer | string | null) {
  if (!s) return null;
  try {
    const str = Buffer.isBuffer(s) ? s.toString() : String(s);
    return JSON.parse(str);
  } catch (err) {
    return null;
  }
}

/* ---------- DB operations ---------- */

async function updateApprovalStatusAndInsertEvent(client: any, contextId: string, newStatus: string, action: string, actor: string | undefined, notes: any) {
  // 1) update approvals.status (idempotent-ish: QUERIES.UPDATE_APPROVAL_STATUS will update)
  const res = await client.query(QUERIES.UPDATE_APPROVAL_STATUS, [newStatus, contextId]);
  const updatedRow = res.rows?.[0] ?? null;

  // 2) insert audit event
  const eventPayload = {
    action,
    actor: actor ?? "human",
    notes: notes ?? null,
    timestamp: new Date().toISOString(),
  };
  await client.query(QUERIES.INSERT_EVENT, [contextId, "human_action", eventPayload, actor ?? "human"]);

  return updatedRow;
}

/* ---------- webhook helper (same logic as before) ---------- */

async function sendEventToWebhookAndLog(webhookUrl: string, contextId: string, newStatus: string, action: string, actor: string | undefined, notes: any) {
  let result: any = null;
  try {
    const payload = {
      context_id: contextId,
      status: newStatus,
      action,
      actor: actor ?? "human",
      notes: notes ?? null,
      timestamp: new Date().toISOString(),
    };

    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    result = { ok: r.ok, status: r.status };
  } catch (err: any) {
    result = { ok: false, error: String(err) };
    console.error(`${LOG_PREFIX} webhook call failed for context=${contextId} url=${webhookUrl}`, err);
  }

  // log webhook result to events table
  try {
    await pool.query(QUERIES.INSERT_EVENT, [
      contextId,
      "webhook_notification",
      { webhookUrl, result, timestamp: new Date().toISOString() },
      "system",
    ]);
  } catch (err) {
    console.warn(`${LOG_PREFIX} failed to record webhook event for context=${contextId}`, err);
  }

  return result;
}

/* ---------- message handler ---------- */

async function handleMessage(messageValue: Buffer | string | null) {
  const raw = messageValue ? (Buffer.isBuffer(messageValue) ? messageValue.toString() : String(messageValue)) : null;
  const payload = safeParseJson(raw);
  if (!payload) {
    console.warn(`${LOG_PREFIX} skipping invalid JSON message`);
    return;
  }

  // Expect payload to include context_id and action
  const contextId = payload?.context_id ?? payload?.contextId ?? null;
  const action = payload?.action ?? null;
  const actor = payload?.actor ?? payload?.performedBy ?? "human";
  const notes = payload?.notes ?? null;

  if (!contextId || !action) {
    console.warn(`${LOG_PREFIX} missing context_id or action — skipping`, { payload });
    return;
  }

  // normalize status
  const newStatus = action === "approve" ? "approved" : action === "deny" ? "denied" : "rollback";

  let committed = false;
  let updatedRow: any = null;

  try {
    await runTransactionWithRetries(
      async (client) => {
        updatedRow = await updateApprovalStatusAndInsertEvent(client, contextId, newStatus, action, actor, notes);
        return true;
      },
      { maxRetries: 3, baseDelayMs: 200 }
    );

    committed = true;
    console.log(`${LOG_PREFIX} applied human_action context=${contextId} action=${action}`);
  } catch (err) {
    console.error(`${LOG_PREFIX} DB transaction failed for context=${contextId}`, err);
    return;
  }

  // after commit, call webhook if present in snapshot (best-effort)
  if (committed) {
    try {
      // snapshot may be available on updatedRow.snapshot
      const snapshot = updatedRow?.snapshot ?? null;
      let webhookUrl: string | null = null;
      if (snapshot) {
        try {
          webhookUrl = snapshot.webhook ?? snapshot.meta?.webhook ?? snapshot.metadata?.webhook ?? null;
        } catch (err) {
          webhookUrl = null;
        }
      }

      if (webhookUrl) {
        await sendEventToWebhookAndLog(webhookUrl, contextId, newStatus, action, actor, notes);
        console.log(`${LOG_PREFIX} webhook notification attempted for context=${contextId}`);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} error handling post-commit webhook for context=${contextId}`, err);
    }
  }
}

/* ---------- bootstrap / runner ---------- */

async function run() {
  const ok = await ensureDbConnection();
  if (!ok) process.exit(1);

  // create consumer subscribed to the human responses topic
  const consumer = await createConsumer(config.kafka.groupId_humans, [TOPICS.HUMAN_RESPONSES], false);
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        await handleMessage(message.value);
      } catch (err) {
        console.error(`${LOG_PREFIX}message handler error`, err);
      }
    },
  });

  // graceful shutdown
  async function shutdown() {
    console.log(`${LOG_PREFIX} shutting down`);
    try {
      await consumer.disconnect();
    } catch (e) {
      console.warn(`${LOG_PREFIX} consumer disconnect error`, e);
    }
    try {
      await pool.end();
    } catch (e) {
      console.warn(`${LOG_PREFIX} pg pool end error`, e);
    }
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch((err) => {
  console.error(`${LOG_PREFIX} fatal`, err);
  process.exit(1);
});
