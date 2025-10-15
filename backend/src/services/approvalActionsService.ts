// src/services/approvalActionsService.ts
import { getProducer, TOPICS } from "../kafka.js";
import { uuid, nowIso } from "../util.js";
import { pool } from "../postgres.js";
import { QUERIES } from "../queries.js";
import type { Producer } from "kafkajs";

type Action = "approve" | "deny" | "rollback";

/**
 * Publish a human action to Kafka (publish-first pattern).
 *
 * Minimal change: instead of updating DB directly, we publish an event to Kafka
 * so a consumer can persist the change and trigger webhooks. This keeps the
 * service lightweight and scales better.
 *
 * Returns { ok: true, queued: true, event } on success, or { ok: false, error }.
 */
export async function performApprovalAction(opts: {
  contextId: string;
  action: Action;
  actor?: string; // who clicked the button
  notes?: string;
}) {
  const { contextId, action, actor = "human", notes } = opts;

  if (!contextId || typeof contextId !== "string") {
    return { ok: false as const, error: new Error("contextId required") };
  }

  // Build the event payload
  const event = {
    event_id: uuid(),
    eventType: "human_action",
    context_id: contextId,
    action,
    actor,
    notes: notes ?? null,
    timestamp: nowIso(),
  };

  // Publish to Kafka
  try {
    const producer: Producer = await getProducer(); // uses default client id
    await producer.send({
      topic: TOPICS.HUMAN_RESPONSES,
      messages: [
        {
          key: contextId,
          value: JSON.stringify(event),
          headers: { source: "approvalActionsService", eventType: "human_action" },
        },
      ],
      acks: -1,
    });

    // Successfully queued
    return {
      ok: true as const,
      queued: true as const,
      event,
    };
  } catch (err: any) {
    console.error("[approvalActionsService]AAAA failed to publish human_action", err);
    return { ok: false as const, error: err };
  }
}