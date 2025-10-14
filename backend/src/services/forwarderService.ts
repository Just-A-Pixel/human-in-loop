// src/services/forwarderService.ts
import type { Producer } from "kafkajs";
import { ApprovalEnvelopeSchema } from "../envelope.js";
import type { ApprovalEnvelope } from "../envelope.js";
import { pool } from "../postgres.js";
import { QUERIES } from "../queries.js";

/**
 * Validate the incoming envelope using Zod.safeParse.
 * Returns { ok: true, envelope } or { ok: false, errors }.
 */
function validateEnvelope(envelopeBody: any) {
  const parsed = ApprovalEnvelopeSchema.safeParse(envelopeBody);
  if (!parsed.success) {
   const errors = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
    return { ok: false as const, errors };
  }
  return { ok: true as const, envelope: parsed.data as ApprovalEnvelope };
}

/**
 * Build a Kafka message payload from a validated envelope.
 */
function buildMessage(envelope: ApprovalEnvelope) {
  return {
    key: envelope.session_id,
    value: JSON.stringify(envelope),
    headers: { eventType: "approval_requested" },
  };
}

/**
 * Send message to Kafka using the provided producer.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
async function sendToKafka(producer: Producer, topic: string, message: any) {
  try {
    await producer.send({
      topic,
      messages: [message],
      acks: -1,
    });
    return { ok: true as const };
  } catch (err: any) {
    return { ok: false as const, error: err };
  }
}

/**
 * Shape accepted response payload
 */
function acceptedResponse(envelope: ApprovalEnvelope) {
  return {
    status: "accepted",
    contextId: envelope.snapshot.context_id,
    streamId: envelope.session_id,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Shape error response payload
 */
function errorResponse(err: any) {
  return {
    status: "error",
    message: "Failed to publish to backend (temporarily unavailable)",
    detail: String(err),
  };
}

/**
 * Public: validate -> build -> send -> return structured result
 */
export async function publishApproval(opts: { producer: Producer; envelopeBody: any }) {
  const { producer, envelopeBody } = opts;

  // 1) validate
  const validated = validateEnvelope(envelopeBody);
  if (!validated.ok) {
    return {
      accepted: false,
      payload: {
        ok: false,
        errors: validated.errors,
      },
    };
  }
  const envelope = validated.envelope;

  // 2) build message
  const message = buildMessage(envelope);

  // 3) send to kafka
  const topic = process.env.WORKFLOW_TOPIC ?? "workflow-events";
  const sent = await sendToKafka(producer, topic, message);
  if (!sent.ok) {
    console.error("[forwarderService] publish failed", sent.error);
    return {
      accepted: false,
      payload: errorResponse(sent.error),
    };
  }

  // 4) success
  return {
    accepted: true,
    payload: acceptedResponse(envelope),
  };
}

/**
 * Fetch all approval requests assigned to a given approver.
 *
 * @param opts.approverName - the approver identifier (mapped to approvals.approver_name)
 * @param opts.limit (optional) - page size
 * @param opts.offset (optional) - pagination offset
 *
 * Returns { ok: true, approvals: [...] } or { ok: false, error }
 */
export async function getAllRequests(opts: {
  approverName: string;
  limit?: number;
  offset?: number;
}) {
  const { approverName, limit, offset } = opts;

  if (!approverName || approverName.trim() === "") {
    return { ok: false as const, error: new Error("approverName is required") };
  }

  try {
    // Currently using the SELECT_APPROVALS_BY_APPROVER query which orders by created_at desc
    // If you want pagination, you can extend the query to include LIMIT/OFFSET and pass limit/offset.
    const clientResult = await pool.query(QUERIES.SELECT_APPROVALS_BY_APPROVER, [
      approverName,
      limit ?? null,
      offset ?? null,
    ]);

    // rows contain the approvals fields specified by the query
    const approvals = clientResult.rows ?? [];

    return { ok: true as const, approvals };
  } catch (err: any) {
    console.error("[forwarderService] getAllRequests error", err);
    return { ok: false as const, error: err };
  }
}