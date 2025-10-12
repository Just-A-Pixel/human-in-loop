import express from "express";
import bodyParser from "body-parser";
import { createProducer, ensureTopics, TOPICS } from "./common.js";
import { uuid, nowIso } from "./util.js";
import { config } from "./config.js";

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
  app.post("/events", async (req, res) => {
    const envelope = {
      ...req.body,
      createdAt: nowIso(),
      correlationId: uuid(),
    };

    try {
      await producer.send({
        topic: TOPICS.WORKFLOW_EVENTS,
        messages: [
          {
            key: envelope.streamId ?? uuid(),
            value: JSON.stringify(envelope),
            headers: { eventType: envelope.eventType ?? "UnknownEvent" },
          },
        ],
        acks: -1,
      });

      return res.status(202).json({
        status: "accepted",
        eventId: envelope.eventId ?? uuid(),
        streamId: envelope.streamId ?? "unknown",
      });
    } catch (err: any) {
      console.error("[forwarder] failed to publish to Kafka:", err?.message ?? err);
      return res.status(503).json({
        status: "error",
        message: "failed to publish to backend (temporarily unavailable)",
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
