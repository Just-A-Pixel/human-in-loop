// src/common.ts
import { Kafka, logLevel, Producer, Consumer } from "kafkajs";
import { config } from "./config.js";

/**
 * Centralized Kafka helpers used by producer, orchestrator, adapters, etc.
 * - Uses config from src/config.ts
 * - Exposes helper factories and canonical topic names
 */

export const KAFKA_BROKER = config.kafka.broker;
export const KAFKA_CLIENT_ID = config.kafka.clientId;
export const KAFKA_GROUP_ID = config.kafka.groupId;

export const TOPICS = {
  WORKFLOW_EVENTS: config.kafka.topics.workflowEvents,
  APPROVAL_REQUESTS: config.kafka.topics.approvalRequests,
  HUMAN_RESPONSES: config.kafka.topics.humanResponses,
} as const;

export type EventPayload = Record<string, any>;

export interface Event {
  eventId: string;
  streamId: string;
  eventType: string;
  payload: EventPayload;
  causationId?: string | null;
  correlationId?: string | null;
  createdAt?: string;
}

/**
 * Create a configured Kafka client instance.
 * Caller may provide a custom clientId (defaults to config.kafka.clientId).
 */
export function createKafkaClient(clientId = KAFKA_CLIENT_ID) {
  return new Kafka({
    clientId,
    brokers: [KAFKA_BROKER],
    logLevel: logLevel.INFO,
  });
}

/**
 * Convenience helper: create & connect a producer with sensible defaults.
 * Example: const producer = await createProducer("agent-producer");
 */
export async function createProducer(clientId = `${KAFKA_CLIENT_ID}-producer`): Promise<Producer> {
  const kafka = createKafkaClient(clientId);
  const producer = kafka.producer({
    // kafkajs retry defaults are okay for MVP; tune for prod if needed
    retry: { retries: 5 },
  });
  await producer.connect();
  return producer;
}

/**
 * Convenience helper: create & connect a consumer subscribed to given topics.
 * Example: const consumer = await createConsumer("orchestrator-group", [TOPICS.WORKFLOW_EVENTS]);
 */
export async function createConsumer(
  groupId = config.kafka.groupId,
  topics: string[] = []
): Promise<Consumer> {
  const kafka = createKafkaClient(`${KAFKA_CLIENT_ID}-consumer`);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  for (const t of topics) {
    await consumer.subscribe({ topic: t, fromBeginning: true });
  }
  return consumer;
}

/**
 * Ensure topics exist in Kafka.
 * Returns:
 *   true  => all topics verified or successfully created
 *   false => one or more topics could not be created (errors logged)
 */
export async function ensureTopics(): Promise<boolean> {
  const kafka = createKafkaClient(`${KAFKA_CLIENT_ID}-admin`);
  const admin = kafka.admin();
  await admin.connect();

  const topics = [
    { topic: TOPICS.WORKFLOW_EVENTS, numPartitions: 3, replicationFactor: 1 },
    { topic: TOPICS.APPROVAL_REQUESTS, numPartitions: 3, replicationFactor: 1 },
    { topic: TOPICS.HUMAN_RESPONSES, numPartitions: 3, replicationFactor: 1 },
  ];

  try {
    const created = await admin.createTopics({ topics, waitForLeaders: true });

    if (created) {
      console.log("[kafka] Topics created:", topics.map((t) => t.topic).join(", "));
    } else {
      console.log("[kafka] Topics already exist or no new topics created.");
    }

    await admin.disconnect();
    return true;
  } catch (err: any) {
    console.error("[kafka] Failed to ensure topics:", err.message || err);
    try {
      await admin.disconnect();
    } catch {}
    return false;
  }
}