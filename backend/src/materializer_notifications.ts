// src/materializer_notifier.ts
import "source-map-support/register.js";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import { createConsumer, TOPICS } from "./kafka.js";
import { pool, ensureDbConnection } from "./postgres.js";
import { config } from "./config.js";
import { QUERIES } from "./queries.js";

const LOG_PREFIX = `[${config.materializer.name}-notifier]`;

/**
 * Sample email sender using nodemailer.
 * Expects SMTP_HOST, SMTP_PORT, SMTP_FROM in env (compatible with MailHog in dev).
 */
async function sendEmail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST ?? "mailhog";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const from = process.env.SMTP_FROM ?? "no-reply@example.com";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    // In dev MailHog doesn't need auth; add auth in prod if required
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  return { ok: true, info };
}

/**
 * Post a payload to an n8n / webhook endpoint.
 */
async function postWebhook(url: string, payload: any) {
  try {
    const res = await fetch("http://host.docker.internal:5678/webhook-test/5a92773c-8f1b-4366-adb2-fa22ee4f495e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
       console.log("BBBBB")

    return { ok: res.ok, status: res.status, body: text };

  } catch (err: any) {
   console.log("AAAAA")
   console.log(err)
    return { ok: false, error: String(err) };
  }
}

/**
 * Read channels row for a username from the `channels` table.
 * Returns null if no row found.
 */
async function getChannelsForUser(username: string) {
  const q = await pool.query(`SELECT * FROM channels WHERE username = $1 LIMIT 1`, [username]);
  return q.rows?.[0] ?? null;
}

/**
 * Handle a single notification event payload.
 *
 * Expected notification payload (lightweight):
 * {
 *   eventType: "approval_created",
 *   context_id: "ctx-abc-123",
 *   approver: "test",
 *   title: "Deploy...",
 *   createdAt: "...",
 *   snapshotSummary: { ... }
 * }
 */
async function handleNotificationEvent(notification: any) {
  const contextId = notification?.context_id ?? notification?.contextId ?? null;
  const approver = notification?.approver ?? "test";

  if (!contextId) {
    console.warn(`${LOG_PREFIX} notification missing context_id`, { notification });
    return;
  }

  // Lookup channels for approver/username
  const channelsRow = await getChannelsForUser(approver);
  if (!channelsRow) {
    console.log(`${LOG_PREFIX} no channels configured for user=${approver}; skipping notifications`);
    // still record that we attempted to notify (optional)
    await pool.query(QUERIES.INSERT_EVENT, [
      contextId,
      "notification_skipped",
      { notification, reason: "no_channels", timestamp: new Date().toISOString() },
      "notifier",
    ]);
    return;
  }

  // Build parallel tasks for available channels
  const tasks: Promise<any>[] = [];
  const results: Record<string, any> = {};

  // n8n webhook (POST)
  if (channelsRow.n8n) {
    const url = channelsRow.n8n;
    const p = postWebhook(url, notification)
      .then((r) => {
        results.n8n = r;
        return r;
      })
      .catch((err) => {
        results.n8n = { ok: false, error: String(err) };
        return results.n8n;
      });
    tasks.push(p);
  }

  // email (if channels table has an email column)
  if (channelsRow.email) {
    // channelsRow.email expected to be a comma-separated address or single email
    const to = channelsRow.email;
    const subject = `[Lyzer] ${notification?.title ?? "Approval request"}`;
    const html = `<p>You have a new approval request:</p><pre>${JSON.stringify(notification, null, 2)}</pre>`;
    const p = sendEmail(to, subject, html)
      .then((r) => {
        results.email = r;
        return r;
      })
      .catch((err) => {
        results.email = { ok: false, error: String(err) };
        return results.email;
      });
    tasks.push(p);
  }

  // If channelsRow has other channel columns later, handle similarly (e.g., sms, slack)

  if (tasks.length === 0) {
    console.log(`${LOG_PREFIX} no actionable channels for user=${approver}`, { channelsRow });
    await pool.query(QUERIES.INSERT_EVENT, [
      contextId,
      "notification_skipped",
      { notification, reason: "no_actionable_channels", channelsRow, timestamp: new Date().toISOString() },
      "notifier",
    ]);
    return;
  }

  // Run all notification tasks in parallel
  const settled = await Promise.allSettled(tasks);

  // Consolidate results (some tasks already wrote into results via .then)
  const payload = {
    notification,
    results,
    settled: settled.map((s) => (s.status === "fulfilled" ? { status: "fulfilled" } : { status: "rejected", reason: (s as any).reason } )),
    timestamp: new Date().toISOString(),
  };

  // Record notification_sent event
  try {
    await pool.query(QUERIES.INSERT_EVENT, [
      contextId,
      "notification_sent",
      payload,
      "notifier",
    ]);
    console.log(`${LOG_PREFIX} notification_sent recorded for context=${contextId}`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} failed to record notification_sent event`, err);
  }
}

/* ---------- bootstrap / runner ---------- */

async function run() {
  const ok = await ensureDbConnection();
  if (!ok) process.exit(1);

  // create consumer subscribed to NOTIFICATION_EVENTS
  const consumer = await createConsumer(config.kafka.groupId_notifications, [TOPICS.NOTIFICATION_EVENTS], false);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const raw = message.value ? (Buffer.isBuffer(message.value) ? message.value.toString() : String(message.value)) : null;
        if (!raw) {
          console.warn(`${LOG_PREFIX} empty notification message`);
          return;
        }
        let payload = null;
        try {
          payload = JSON.parse(raw);
        } catch (err) {
          console.warn(`${LOG_PREFIX} invalid JSON notification`, err);
          return;
        }

        await handleNotificationEvent(payload);
      } catch (err) {
        console.error(`${LOG_PREFIX} message handler error`, err);
      }
    },
  });

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
}

run().catch((err) => {
  console.error(`${LOG_PREFIX} fatal`, err);
  process.exit(1);
});
