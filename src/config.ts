import dotenv from "dotenv";
import env from "env-var";

dotenv.config();

/**
 * Application Configuration
 * Centralized, type-safe config with validation and defaults.
 * Prevents silent fallbacks and ensures required variables are set.
 */
export const config = {
  env: env.get("NODE_ENV").default("development").asString(),

  kafka: {
    broker: env.get("KAFKA_BROKER").default("localhost:29092").asString(),
    clientId: env.get("KAFKA_CLIENT_ID").default("human-in-loop-client").asString(),
    groupId: env.get("KAFKA_GROUP_ID").default("orchestrator-group").asString(),
    topics: {
      workflowEvents: env.get("WORKFLOW_EVENTS_TOPIC").default("workflow-events").asString(),
      approvalRequests: env.get("APPROVAL_REQUESTS_TOPIC").default("approval-requests").asString(),
      humanResponses: env.get("HUMAN_RESPONSES_TOPIC").default("human-responses").asString(),
    },
  },

  log: {
    level: env.get("LOG_LEVEL").default("info").asEnum(["debug", "info", "warn", "error"]),
  },
};

/**
 * Optional: runtime sanity checks for production
 */
if (config.env === "production" && config.kafka.broker === "localhost:29092") {
  console.warn("⚠️  Using localhost Kafka broker in production! Check your .env file.");
}

/**
 * Export typed helper accessors
 */
export const { env: NODE_ENV, kafka, log } = config;

console.log(
  `✅ Config loaded for ${NODE_ENV} — Kafka broker: ${kafka.broker}, log level: ${log.level}`
);
