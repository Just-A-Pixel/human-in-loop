// src/materializer.ts
import "source-map-support/register.js";
import { createConsumer, TOPICS, getProducer } from "./kafka.js";
import { pool, ensureDbConnection, runTransactionWithRetries } from "./postgres.js";
import { config } from "./config.js";
import { QUERIES } from "./queries.js";

const LOG_PREFIX = `[${config.materializer.name}]`;

// No other event is being handled by this kafka topic.
const EVENT_TYPE = "approval_requested";

/** --- Kafka consumer --- */
const consumer = await createConsumer(config.kafka.groupId_agents, [TOPICS.WORKFLOW_EVENTS], false);

/* ---------- Utility helpers ---------- */

function safeParseJson(s: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function deriveContextId(payload: any) {
  return (
    payload?.snapshot?.context_id ??
    payload?.context_id ??
    payload?.session_id ??
    payload?.streamId ??
    null
  );
}

/* ---------- DB logic (uses QUERIES) ---------- */

async function insertEvent(client: any, contextId: string, type: string, payload: any, actor?: string) {
  await client.query(QUERIES.INSERT_EVENT, [contextId, type, payload, actor ?? "agent"]);
}

async function upsertApprovalRequest(client: any, contextId: string, payload: any) {
  const snapshot = payload.snapshot ?? payload;
  const approver = payload.approver?? null;
  const title = payload.title ?? snapshot?.title ?? null;
  const deadline = payload.deadline ?? snapshot?.deadline ?? null;
  const turns = snapshot?.turns ?? [];

  await client.query(QUERIES.UPSERT_APPROVAL_REQUEST, [
    contextId,
    approver,
    title,
    deadline ? new Date(deadline) : null,
    JSON.stringify(turns),
    JSON.stringify(snapshot),
  ]);
}


/* ---------- Notification publisher ---------- */

/**
 * Publishes a compact approval notification event
 * after a new approval request has been persisted.
 *
 * This allows downstream systems (e.g., Slack, UI, email)
 * to react to new approvals without touching workflow-events.
 */
async function publishApprovalNotification(contextId: string, payload: any) {
  const producer = await getProducer();

  // Construct lightweight notification payload
  const notification = {
    eventType: "approval_created",
    context_id: contextId,
    approver: payload.approver?? "test",
    title: payload.title ?? payload?.snapshot?.title ?? null,
    createdAt: new Date().toISOString(),
    snapshotSummary: {
      variables: payload.snapshot?.variables ?? null,
    },
  };

  // Produce to NOTIFICATION_EVENTS topic
  await producer.send({
    topic: TOPICS.NOTIFICATION_EVENTS,
    messages: [
      {
        key: contextId,
        value: JSON.stringify(notification),
        headers: { source: "materializer", eventType: "approval_created" },
      },
    ],
  });

  console.log(
    `${LOG_PREFIX} published notification for context=${contextId} topic=${TOPICS.NOTIFICATION_EVENTS}`
  );
}

/* ---------- Message handling ---------- */

// Takes approval_requested out of kafka, appends to approval table and events table
async function handleMessage(messageValue: Buffer | string | null, headers: Record<string, any> | undefined) {
  const raw = messageValue ? messageValue.toString() : null;

  const payload = safeParseJson(raw);
  if (!payload) {
    console.warn(`${LOG_PREFIX} skipping invalid JSON message`);
    return;
  }

  const contextId = deriveContextId(payload);
  if (!contextId) {
    console.warn(`${LOG_PREFIX} missing context id — skipping message`, { payload });
    return;
  }

  let committed = false;
  try {
    await runTransactionWithRetries(
      async (client) => {
        await insertEvent(client, contextId, EVENT_TYPE, payload, payload?.requester ?? payload?.actor ?? "agent");
        await upsertApprovalRequest(client, contextId, payload);
        return true;
      },
      { maxRetries: 3, baseDelayMs: 200 }
    );

    committed = true;
    console.log(`${LOG_PREFIX} processed event=${EVENT_TYPE} context=${contextId}`);
  } catch (err) {
    console.error(`${LOG_PREFIX} DB transaction failed for context=${contextId} after retries`, err);
    return;
  }

  if (committed) {
    try {
      await publishApprovalNotification(contextId, payload);
    } catch (err) {
      console.error(`${LOG_PREFIX} failed to publish notification for context=${contextId}`, err);
      // don't rethrow — materializer continues consuming; consider DLQ for production
    }
  }
}

/* ---------- Runner ---------- */

async function run() {
  const ok = await ensureDbConnection();
  if (!ok) process.exit(1);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        await handleMessage(message.value, message.headers as any);
      } catch (err) {
        console.error(`${LOG_PREFIX} message handler error`, err);
      }
    },
  });
}

/* ---------- Graceful shutdown ---------- */

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

run().catch((err) => {
  console.error(`${LOG_PREFIX} fatal`, err);
  process.exit(1);
});
