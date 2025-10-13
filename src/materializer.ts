// src/materializer.ts
import "source-map-support/register.js";
import { Kafka, logLevel } from "kafkajs";
import { Pool } from "pg";
import { config } from "./config.js";
import { QUERIES } from "./queries.js";

const LOG_PREFIX = `[${config.materializer.name}]`;

/** --- Postgres pool (from config) --- */
const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: config.postgres.poolMax,
  idleTimeoutMillis: 30_000,
});

/** --- Kafka consumer (from config) --- */
const kafka = new Kafka({
  clientId: `${config.kafka.clientId}-${config.materializer.name}`,
  brokers: [config.kafka.broker],
  logLevel: logLevel.INFO,
});
const consumer = kafka.consumer({ groupId: config.kafka.groupId });

/* ---------- Utility helpers ---------- */

function safeParseJson(s: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function deriveEventType(payload: any, headers?: Record<string, any>) {
  const header = headers?.eventType ? headers.eventType.toString() : undefined;
  return header ?? payload?.eventType ?? payload?.type ?? "unknown";
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

/* ---------- DB logic ---------- */

async function insertEvent(client: any, contextId: string, type: string, payload: any, actor?: string) {
  await client.query(QUERIES.INSERT_EVENT, [contextId, type, payload, actor ?? "agent"]);
}

async function upsertApprovalRequest(client: any, contextId: string, payload: any) {
  const snapshot = payload.snapshot ?? payload;
  const approver = payload.requester ?? snapshot?.requester ?? null;
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

async function updateApprovalStatus(client: any, contextId: string, payload: any) {
  const decision =
    payload.decision ??
    payload.inputs?.decision ??
    payload.status ??
    payload?.result?.decision ??
    null;

  let newStatus: string | null = null;
  if (typeof decision === "string") {
    const d = decision.toLowerCase();
    if (d.includes("reject")) newStatus = "rejected";
    else if (d.includes("approve")) newStatus = "approved";
  }

  if (!newStatus && typeof payload.status === "string") {
    newStatus = payload.status;
  }

  if (newStatus) {
    await client.query(QUERIES.UPDATE_APPROVAL_STATUS, [newStatus, contextId]);
    return true;
  }
  return false;
}

/* ---------- Message handling ---------- */

async function handleMessage(messageValue: Buffer | string | null, headers: Record<string, any> | undefined) {
  const raw = messageValue ? messageValue.toString() : null;
  const payload = safeParseJson(raw);

  if (!payload) {
    console.warn(`${LOG_PREFIX} skipping invalid JSON message`);
    return;
  }

  const eventType = deriveEventType(payload, headers);
  const contextId = deriveContextId(payload);

  if (!contextId) {
    console.warn(`${LOG_PREFIX} missing context id — skipping message`, { eventType });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await insertEvent(client, contextId, eventType, payload, payload?.requester ?? payload?.actor ?? "agent");

    if (["approval_requested"].includes(eventType) || ["approval_requested"].includes(payload.eventType) || ["approval_requested"].includes(payload.type)) {
      await upsertApprovalRequest(client, contextId, payload);
    }

    if (["approval_response"].includes(eventType) || ["approval_response"].includes(payload.eventType) || ["approval_response"].includes(payload.type)) {
      const changed = await updateApprovalStatus(client, contextId, payload);
      if (!changed) console.log(`${LOG_PREFIX} approval_response for ${contextId} had no decision`);
    }

    await client.query("COMMIT");
    console.log(`${LOG_PREFIX} processed event=${eventType} context=${contextId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`${LOG_PREFIX} DB transaction failed for context=${contextId}`, err);
  } finally {
    client.release();
  }
}

/* ---------- Runner ---------- */

async function run() {
  try {
    await pool.query("SELECT 1");
    console.log(`${LOG_PREFIX} connected to Postgres`);
  } catch (err) {
    console.error(`${LOG_PREFIX} cannot connect to Postgres`, err);
    process.exit(1);
  }

  await consumer.connect();
  await consumer.subscribe({ topic: config.kafka.topics.workflowEvents, fromBeginning: false });
  console.log(`${LOG_PREFIX} subscribed to topic ${config.kafka.topics.workflowEvents}`);

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
