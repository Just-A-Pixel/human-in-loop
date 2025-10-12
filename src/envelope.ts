/**
 * envelope.ts
 *
 * Minimal envelope builder + validator (TypeScript)
 *
 * Minimal required fields:
 *  - eventType: string
 *  - payload: object
 *  - streamId: string    // IMPORTANT: streamId == threadId (canonical workflow/thread id)
 *
 * This module performs small runtime checks and returns a normalized envelope suitable
 * for immediate publishing to Kafka.
 */

import { uuid, nowIso } from "./util.js";

export interface MinimalInput {
  eventType?: unknown;
  payload?: unknown;
  streamId?: unknown;
  eventId?: unknown;
  createdAt?: unknown;
}

export interface Envelope {
  eventId: string;
  eventType: string;
  streamId: string; // streamId should be treated as the canonical threadId
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Validate an input object for minimal envelope requirements.
 * Returns an array of error messages (empty if valid).
 */
export function validateMinimalInput(input: MinimalInput): string[] {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push("Request body must be a JSON object.");
    return errors;
  }

  if (!("eventType" in input)) errors.push("Missing required field: eventType");
  if (!("payload" in input)) errors.push("Missing required field: payload");
  if (!("streamId" in input)) errors.push("Missing required field: streamId");

  if ("eventType" in input && typeof input.eventType !== "string")
    errors.push("Invalid eventType: must be a string");

  if ("streamId" in input && typeof input.streamId !== "string")
    errors.push("Invalid streamId: must be a string");

  if ("payload" in input && (typeof input.payload !== "object" || input.payload === null))
    errors.push("Invalid payload: must be a JSON object");

  return errors;
}

/**
 * Build a minimal envelope. Throws Error on invalid input.
 */
export function buildEnvelope(input: MinimalInput): Envelope {
  const errors = validateMinimalInput(input);
  if (errors.length > 0) {
    throw new Error(`Invalid envelope input: ${errors.join("; ")}`);
  }

  // At this point types are safe to coerce
  const eventType = String(input.eventType as string);
  const streamId = String(input.streamId as string);
  const payload = input.payload as Record<string, unknown>;

  const envelope: Envelope = {
    eventId: typeof input.eventId === "string" ? input.eventId : uuid(),
    eventType,
    streamId, // NOTE: streamId == threadId in our system design
    payload,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : nowIso(),
  };

  return envelope;
}
