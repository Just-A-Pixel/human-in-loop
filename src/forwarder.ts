import express from "express";
import bodyParser from "body-parser";
import { createProducer, ensureTopics, TOPICS } from "./common.js";
import { uuid, nowIso } from "./util.js";
import { config } from "./config.js";
import approvalsRouter from "./routes/approvals.js";
import { errorHandler } from "./middleware/errorHandler.js";

/**
 * FORWARDER SERVICE 
 * ------------------------------------
 * - Ensures Kafka topics exist
 * - Creates a Kafka producer
 * - Exposes /api
 *
 */

const PORT = Number(config.forwarder.port);

async function run() {
  const ok = await ensureTopics();
  if (!ok) {
    console.error("[forwarder] Kafka topic setup failed — shutting down");
    process.exit(1);
  }

  const producer = await createProducer(`${config.kafka.clientId}-forwarder`);

  const app = express();
  app.use(bodyParser.json({ limit: "256kb" }));

  app.locals.producer = producer;

  app.use("/api", approvalsRouter);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[forwarder] listening on http://localhost:${PORT}`);
  });
}

run().catch((e) => {
  console.error("[forwarder] fatal", e);
  process.exit(1);
});
