// // src/notifier.ts
// import "source-map-support/register.js";
// import nodemailer from "nodemailer";
// import type { PoolClient } from "pg";
// import { createConsumer, TOPICS } from "./kafka.js";
// import { config } from "./config.js";
// import { pool, ensureDbConnection, closeDbPool, withTransaction } from "./postgres.js";
// import { QUERIES } from "./queries.js";

// const LOG_PREFIX = `[notifier]`;

// // /**
// //  * Notifier
// //  * - consumes notification events from TOPICS.NOTIFICATION_EVENTS
// //  * - each message should include at least one of: user_id, approver (email)
// //  * - looks up user in users table, reads channels (text[]), and dispatches per-channel workers
// //  *
// //  * Expected notification payload shape (flexible):
// //  * {
// //  *   eventType: "approval_created",
// //  *   context_id: "ctx-abc-123",
// //  *   user_id: "<uuid>",        // preferred
// //  *   approver: "alice@example.com", // fallback
// //  *   title: "Approve deploy",
// //  *   createdAt: "...",
// //  *   snapshotSummary: {...}
// //  * }
// //  */

// // /* ---------- Create Kafka consumer ---------- */
// const consumer = await createConsumer(config.kafka.groupId, [TOPICS.NOTIFICATION_EVENTS], false);

// // /* ---------- Nodemailer transport (create once) ---------- */
// // const transporter = nodemailer.createTransport({
// //   host: config.smtp.host,
// //   port: config.smtp.port,
// //   secure: config.smtp.secure,
// //   // MailHog doesn't need auth; in prod you'd add auth here
// // });

// // /* ---------- Channel workers ---------- */

// // async function emailWorker(user: any, notification: any) {
// //   const recipient = user.email ?? config.smtp.from;
// //   const subject = `${config.smtp.subjectPrefix}${notification.title ?? "Notification"}`;
// //   const variables = JSON.stringify(notification.snapshotSummary?.variables ?? {}, null, 2);

// //   const text = [
// //     `${notification.title ?? "New notification"}`,
// //     ``,
// //     `Context ID: ${notification.context_id ?? "unknown"}`,
// //     `Created: ${notification.createdAt ?? new Date().toISOString()}`,
// //     ``,
// //     `Snapshot variables:`,
// //     variables,
// //     ``,
// //     `This is an automated notification.`,
// //   ].join("\n");

// //   const html = `
// //     <h3>${notification.title ?? "New notification"}</h3>
// //     <p><strong>Context:</strong> ${notification.context_id ?? "unknown"}</p>
// //     <pre>${variables}</pre>
// //     <p>This is an automated notification.</p>
// //   `;

// //   const mailOptions = {
// //     from: config.smtp.from,
// //     to: recipient,
// //     subject,
// //     text,
// //     html,
// //   };

// //   try {
// //     const info = await transporter.sendMail(mailOptions);
// //     console.log(`${LOG_PREFIX} email sent to=${recipient} messageId=${info?.messageId ?? "<unknown>"}`);
// //   } catch (err) {
// //     console.error(`${LOG_PREFIX} emailWorker failed for ${recipient}`, err);
// //   }
// // }

// // async function whatsappWorker(user: any, notification: any) {
// //   const to = (user.phone ?? "<no-phone>");
// //   console.log(
// //     `${LOG_PREFIX} [mock-whatsapp] to=${to} user=${user.username ?? user.user_id} ctx=${notification.context_id} title=${notification.title}`
// //   );
// //   return;
// // }

// // const channelHandlers: Record<string, (user: any, notification: any) => Promise<void>> = {
// //   email: emailWorker,
// //   whatsapp: whatsappWorker,
// // };

// // /* ---------- DB lookup helpers ---------- */

// // async function findUser(client: PoolClient, opts: { userId?: string | null; email?: string | null }) {
// //   if (opts.userId) {
// //     const res = await client.query("SELECT * FROM users WHERE user_id = $1", [opts.userId]);
// //     if (res.rowCount != null && res.rowCount > 0) return res.rows[0];
// //   }
// //   if (opts.email) {
// //     const res = await client.query("SELECT * FROM users WHERE email = $1", [opts.email]);
// //     if (res.rowCount != null && res.rowCount > 0) return res.rows[0];
// //   }
// //   return null;
// // }

// // /* ---------- Message handler ---------- */

// // /* ---------- Message handler (refactored to use withTransaction) ---------- */

// // async function handleNotificationMessage(value: Buffer | string | null) {
// //   if (!value) {
// //     console.warn(`${LOG_PREFIX} empty message`);
// //     return;
// //   }

// //   let notification: any;
// //   try {
// //     notification = JSON.parse(value.toString());
// //   } catch (err) {
// //     console.warn(`${LOG_PREFIX} invalid JSON notification`, err);
// //     return;
// //   }

// //   const userId = notification.user_id ?? null;
// //   const approverEmail = notification.approver ?? null;

// //   if (!userId && !approverEmail) {
// //     console.warn(`${LOG_PREFIX} notification missing user_id and approver`, { notification });
// //     return;
// //   }

// //   // Run DB work (lookup user, compute channels, optionally insert event)
// //   let user: any | null = null;
// //   let channels: string[] = [];

// //   try {
// //     const result = await withTransaction(async (txnClient: PoolClient) => {
// //       // 1) Find user using the transaction client
// //       const found = await findUser(txnClient, { userId, email: approverEmail });
// //       if (!found) {
// //         return { user: null, channels: [] };
// //       }

// //       // Normalize channels from Postgres text[] (assume text[])
// //       let chs: string[] = [];
// //       if (Array.isArray(found.channels)) {
// //         chs = found.channels.map((c: any) => String(c).toLowerCase().trim()).filter(Boolean);
// //       } else if (found.channels && typeof found.channels === "string") {
// //         chs = found.channels
// //           .split(",")
// //           .map((s: string) => s.trim().toLowerCase())
// //           .filter(Boolean);
// //       }

// //       // If no channels configured, insert notification_unavailable event inside this transaction
// //       if (!chs || chs.length === 0) {
// //         await txnClient.query(QUERIES.INSERT_EVENT, [
// //           notification.context_id ?? null,
// //           "notification_unavailable",
// //           JSON.stringify({
// //             reason: "User has no notification channels configured",
// //             user_id: found.user_id,
// //             email: found.email,
// //             notification,
// //           }),
// //           "notifier",
// //         ]);
// //         // return the found user but empty channels — caller will early-return
// //         return { user: found, channels: [] };
// //       }

// //       // Return found user + normalized channels
// //       return { user: found, channels: chs };
// //     });

// //     user = result.user;
// //     channels = result.channels;
// //   } catch (err) {
// //     console.error(`${LOG_PREFIX} DB transaction failed while resolving user/channels`, err);
// //     return; // don't proceed to sending notifications
// //   }

// //   // If no user or no channels, we already handled logging inside transaction
// //   if (!user) {
// //     console.warn(`${LOG_PREFIX} no user found for user_id=${userId} email=${approverEmail}`);
// //     return;
// //   }
// //   if (channels.length === 0) {
// //     console.log(`${LOG_PREFIX} No channels for user=${user.user_id}; nothing to send`);
// //     return;
// //   }

// //   // Finally, dispatch to handlers outside of any DB transaction/client
// //   console.log(`${LOG_PREFIX} dispatching to user=${user.username ?? user.user_id} channels=${channels.join(",")}`);

// //   const tasks = channels.map(async (ch) => {
// //     const handler = channelHandlers[ch];
// //     if (!handler) {
// //       console.warn(`${LOG_PREFIX} no handler for channel='${ch}'`);
// //       return;
// //     }
// //     try {
// //       await handler(user, notification);
// //     } catch (err) {
// //       console.error(`${LOG_PREFIX} handler error for channel='${ch}' user=${user.user_id}`, err);
// //     }
// //   });

// //   await Promise.all(tasks);
// // }

// // /* ---------- Runner & lifecycle ---------- */

// // // async function run() {
// // //   // const ok = await ensureDbConnection();
// // //   // if (!ok) {
// // //   //   console.error(`${LOG_PREFIX} DB unreachable, exiting`);
// // //   //   process.exit(1);
// // //   // }

// // //   try {
// // //     await consumer.run({
// // //       eachMessage: async ({ topic, partition, message }) => {
// // //         try {
// // //           // Raw message logging for debugging
// // //           const rawValue = message.value ? message.value.toString() : null;
// // //           const headers = message.headers
// // //             ? Object.fromEntries(
// // //                 Object.entries(message.headers).map(([k, v]) => [k, v?.toString?.() ?? String(v)])
// // //               )
// // //             : {};
  
// // //           console.log(`${LOG_PREFIX} KAFKA MESSAGE received`);
// // //           console.log("  topic:", topic);
// // //           console.log("  partition:", partition);
// // //           console.log("  offset:", message.offset);
// // //           console.log("  key:", message.key?.toString?.());
// // //           console.log("  headers:", headers);
// // //           console.log("  value:", rawValue);
  
// // //           // Optionally: call your message handler (comment/uncomment while debugging)
// // //           // await handleNotificationMessage(message.value);
  
// // //         } catch (err) {
// // //           console.error(`${LOG_PREFIX} logging handler error`, err);
// // //         }
// // //       },
// // //     });
  

// // //     console.log(`${LOG_PREFIX} listening on ${TOPICS.NOTIFICATION_EVENTS}`);
// // //   } catch (err) {
// // //     console.error(`${LOG_PREFIX} consumer.run failed`, err);
// // //     process.exit(1);
// // //   }
// // // }

// async function run() {
//   console.log(`${LOG_PREFIX} starting notifier; broker=${config.kafka.broker} group=${config.kafka.groupId}`);

//   // Explicit subscribe to ensure we're listening to the right topic
//   // try {
//   //   // consumer was returned by createConsumer but we re-subscribe here to control fromBeginning
//   //   await consumer.subscribe({ topic: TOPICS.NOTIFICATION_EVENTS, fromBeginning: true });
//   //   console.log(`${LOG_PREFIX} subscribed to topic=${TOPICS.NOTIFICATION_EVENTS} fromBeginning=true`);
//   // } catch (err) {
//   //   console.error(`${LOG_PREFIX} failed to subscribe to topic ${TOPICS.NOTIFICATION_EVENTS}`, err);
//   //   process.exit(1);
//   // }

//   try {
//     await consumer.run({
//       eachMessage: async ({ message }) => {
//         try {
//           const rawValue = message.value ? message.value.toString() : null;
      

//           console.log(`${LOG_PREFIX} KAFKA MESSAGE received`);;
//           console.log("  key:", message.key?.toString?.());
//           console.log("  value:", rawValue);

//           // Call your actual handler after logging
//           // await handleNotificationMessage(message.value);
//         } catch (err) {
//           console.error(`${LOG_PREFIX} logging/handler error`, err);
//         }
//       },
//     });

//     console.log(`${LOG_PREFIX} consumer.run started for ${TOPICS.NOTIFICATION_EVENTS}`);
//   } catch (err) {
//     console.error(`${LOG_PREFIX} consumer.run failed`, err);
//     process.exit(1);
//   }
// }


// // process.on("SIGINT", async () => {
// //   console.log(`${LOG_PREFIX} SIGINT shutting down`);
// //   try { await consumer.disconnect(); } catch {}
// //   try { await closeDbPool(); } catch {}
// //   process.exit(0);
// // });
// // process.on("SIGTERM", async () => {
// //   console.log(`${LOG_PREFIX} SIGTERM shutting down`);
// //   try { await consumer.disconnect(); } catch {}
// //   try { await closeDbPool(); } catch {}
// //   process.exit(0);
// // });

// run().catch((err) => {
//   console.error(`${LOG_PREFIX} fatal`, err);
//   process.exit(1);
// });
