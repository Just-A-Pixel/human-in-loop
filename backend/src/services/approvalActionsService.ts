// src/services/approvalActionsService.ts
import fetch from "node-fetch";
import { pool, withTransaction } from "../postgres.js";
import { QUERIES } from "../queries.js";

type Action = "approve" | "deny" | "rollback";

export async function performApprovalAction(opts: {
  contextId: string;
  action: Action;
  actor?: string; // who clicked the button
  notes?: string;
}) {
  const { contextId, action, actor = "human", notes } = opts;
  const newStatus = action === "approve" ? "approved" : action === "deny" ? "denied" : "rollback";

  // Run DB transaction to update approval status and insert an event
  let snapshot: any = null;
  let updatedRow: any = null;

  await withTransaction(async (client) => {
    // 1) update approvals.status
    const res = await client.query(QUERIES.UPDATE_APPROVAL_STATUS, [newStatus, contextId]);
    updatedRow = res.rows[0];

    // 2) insert audit event (type 'human_action' with action metadata)
    const eventPayload = {
      action,
      actor,
      notes: notes ?? null,
      timestamp: new Date().toISOString(),
    };
    await client.query(QUERIES.INSERT_EVENT, [contextId, "human_action", eventPayload, actor]);

    snapshot = updatedRow?.snapshot ?? null;
    // commit happens after this function returns
  });

  // After commit: if there is a webhook in snapshot, call it (fire-and-log)
  // snapshot may be JSONB stored; common paths: snapshot.webhook or snapshot.metadata.webhook
  let webhookUrl: string | null = null;
  try {
    if (snapshot) {
      webhookUrl = snapshot.webhook ?? null;
    }
  } catch (err) {
    webhookUrl = null;
  }

  let webhookResult: any = null;
  if (webhookUrl) {
    try {
      const payload = {
        context_id: contextId,
        status: newStatus,
        action,
        actor,
        notes: notes ?? null,
        timestamp: new Date().toISOString(),
      };
      // POST JSON
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // optionally set a short timeout / signal in production
      });
      webhookResult = { ok: r.ok, status: r.status };
    } catch (err: any) {
      webhookResult = { ok: false, error: String(err) };
      console.error("[approvalActionsService] webhook call failed", contextId, webhookUrl, err);
    }

    // Log webhook result into events table (non-transactional; best-effort)
    try {
      await pool.query(QUERIES.INSERT_EVENT, [
        contextId,
        "webhook_notification",
        { webhookUrl, result: webhookResult, timestamp: new Date().toISOString() },
        "system",
      ]);
    } catch (err) {
      console.warn("[approvalActionsService] failed to record webhook event", err);
    }
  }

  return {
    ok: true,
    context_id: contextId,
    status: newStatus,
    webhookCalled: Boolean(webhookUrl),
    webhookResult,
    updated_at: updatedRow?.updated_at ?? new Date().toISOString(),
  };
}
