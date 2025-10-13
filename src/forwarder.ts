import express from "express";
import bodyParser from "body-parser";
import { createProducer, ensureTopics, TOPICS } from "./common.js";
import { uuid, nowIso } from "./util.js";
import { config } from "./config.js";
import { ApprovalEnvelopeSchema } from "./envelope.js";

/**
 * FORWARDER SERVICE 
 * ------------------------------------
 * - Ensures Kafka topics exist
 * - Creates a Kafka producer
 * - Exposes POST /events to publish messages to Kafka
 *
 */

const PORT = Number(config.forwader.port);

async function run() {
  const ok = await ensureTopics();
  if (!ok) {
    console.error("[forwarder] Kafka topic setup failed — shutting down");
    process.exit(1);
  }

  const producer = await createProducer(`${config.kafka.clientId}-forwarder`);

  const app = express();
  app.use(bodyParser.json({ limit: "256kb" }));

  /**
   * POST /events
   * Publishes directly to Kafka (workflow-events topic)
   */
  app.post("/api/approval", async (req, res) => {
    const envelope = ApprovalEnvelopeSchema.parse(req.body);
    const { session_id, title, description, snapshot, actions, rollback_actions } = envelope;
    
    // Publish to Kafka
    try {
      await producer.send({
        topic: TOPICS.WORKFLOW_EVENTS,
        messages: [
          {
            key: envelope.streamId,
            value: JSON.stringify(envelope),
            headers: { eventType: envelope.eventType },
          },
        ],
        acks: -1,
      });

      console.log("[forwarder] published", {
        eventType: envelope.eventType,
        streamId: envelope.streamId,
        eventId: envelope.eventId,
      });

      return res.status(202).json({
        status: "accepted",
        eventId: envelope.eventId,
        streamId: envelope.streamId,
        createdAt: envelope.createdAt,
      });
    } catch (err: unknown) {
      console.error("[forwarder] publish failed:", (err as Error).message || err);
      return res.status(503).json({
        status: "error",
        message: "Failed to publish to backend (temporarily unavailable)",
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`[forwarder] listening on http://localhost:${PORT}`);
    console.log(`[forwarder] endpoint: POST /events`);
  });
}

run().catch((e) => {
  console.error("[forwarder] fatal", e);
  process.exit(1);
});
