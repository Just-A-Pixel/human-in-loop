// src/kafka.ts
import { Kafka, logLevel, Producer, Consumer, Admin } from "kafkajs";
import { config } from "./config.js";

/**
 * Central Kafka helpers — single source of truth for Kafka client/producer/consumer.
 *
 * Usage:
 *   import { getProducer, getConsumer, ensureTopics, TOPICS } from './kafka.js';
 *
 * Important:
 * - getProducer returns a single lazily-created connected producer (singleton).
 * - getConsumer creates and returns a new consumer (callers should keep reference and disconnect when done).
 * - ensureTopics uses an admin client (shared) to create topics if missing.
 */

// constants
export const KAFKA_BROKER = config.kafka.broker;
export const KAFKA_CLIENT_ID = config.kafka.clientId;
export const KAFKA_GROUP_ID = config.kafka.groupId;

export const TOPICS = {
  WORKFLOW_EVENTS: config.kafka.topics.workflowEvents,
  HUMAN_RESPONSES: config.kafka.topics.humanResponses,
  NOTIFICATION_EVENTS: config.kafka.topics.notificationRequests
} as const;

// internal lazy singletons
let _kafkaClient: Kafka | null = null;
let _producer: Producer | null = null;
let _admin: Admin | null = null;

/** Create or return a cached Kafka client */
export function kafkaClient(clientId = KAFKA_CLIENT_ID): Kafka {
  if (_kafkaClient) return _kafkaClient;
  _kafkaClient = new Kafka({
    clientId,
    brokers: [KAFKA_BROKER],
    logLevel: logLevel.INFO,
  });
  return _kafkaClient;
}

/**
 * Get a singleton, connected Producer.
 * - Creating multiple Producer instances can be expensive; reuse recommended.
 */
export async function getProducer(clientId = `${KAFKA_CLIENT_ID}-producer`): Promise<Producer> {
  if (_producer) return _producer;
  const k = kafkaClient(clientId);
  _producer = k.producer({ retry: { retries: 5 } });
  await _producer.connect();
  // register graceful shutdown
  const shutdown = async () => {
    try {
      await _producer?.disconnect();
    } catch {}
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return _producer;
}

/**
 * Create and return a consumer.
 * Caller is responsible for calling consumer.disconnect() when finished.
 *
 * Note: we do not cache consumers as they are intended to be used with groupId/topic combos.
 * If you want a shared consumer, create and reuse it in your service bootstrap.
 */
export async function createConsumer(
  groupId = config.kafka.groupId,
  topics: string[] = [],
  fromBeginning = false
): Promise<Consumer> {
  const k = kafkaClient(`${KAFKA_CLIENT_ID}-consumer`);
  const consumer = k.consumer({ groupId });

  await consumer.connect();

  for (const t of topics) {
    await consumer.subscribe({ topic: t, fromBeginning });
  }

  return consumer;
}

/**
 * Get a (shared) admin client. Lazily created and connected.
 * Caller should not disconnect it directly; use shutdownAll() or let process exit.
 */
export async function getAdmin(): Promise<Admin> {
  if (_admin) return _admin;
  const k = kafkaClient(`${KAFKA_CLIENT_ID}-admin`);
  _admin = k.admin();
  await _admin.connect();
  return _admin;
}

/**
 * Ensure topics exist (idempotent). Returns true if successful.
 */
export async function ensureTopics(): Promise<boolean> {
  const admin = await getAdmin();

  const topics = [
    { topic: TOPICS.WORKFLOW_EVENTS, numPartitions: 3, replicationFactor: 1 },
    { topic: TOPICS.HUMAN_RESPONSES, numPartitions: 3, replicationFactor: 1 },
    { topic: TOPICS.NOTIFICATION_EVENTS, numPartitions: 3, replicationFactor: 1 },
  ];

  try {
    const created = await admin.createTopics({ topics, waitForLeaders: true });
    if (created) {
      console.log("[kafka] Topics created:", topics.map((t) => t.topic).join(", "));
    } else {
      console.log("[kafka] Topics exist (no new topics created).");
    }
    return true;
  } catch (err: any) {
    console.error("[kafka] Failed to ensure topics:", err.message ?? err);
    return false;
  }
}

/** Disconnect shared clients gracefully */
export async function shutdownAll(): Promise<void> {
  const errors: any[] = [];
  try {
    if (_producer) await _producer.disconnect();
  } catch (e) {
    errors.push(e);
  }
  try {
    if (_admin) await _admin.disconnect();
  } catch (e) {
    errors.push(e);
  }
  // _kafkaClient has no explicit disconnect API; producers/consumers/admin disconnect suffice.
  _producer = null;
  _admin = null;
  if (errors.length) {
    console.warn("[kafka] shutdown encountered errors:", errors);
  }
}

/** Ensure shutdownAll is called on process termination */
process.once("SIGINT", () => shutdownAll().catch(() => {}));
process.once("SIGTERM", () => shutdownAll().catch(() => {}));
