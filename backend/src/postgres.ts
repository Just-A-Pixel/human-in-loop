import { Pool, PoolClient } from "pg";
import { config } from "./config.js";

const LOG_PREFIX = "[postgres]";

/**
 * Centralized Postgres connection pool.
 * Reused across all services (materializer, notifier, etc.)
 */
export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: config.postgres.poolMax ?? 10,
  idleTimeoutMillis: 30_000,
});

/**
 * Run a simple health check query to ensure DB connectivity.
 */
export async function ensureDbConnection() {
  try {
    await pool.query("SELECT 1");
    console.log(`${LOG_PREFIX} connected to Postgres at ${config.postgres.host}:${config.postgres.port}`);
    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} failed to connect to Postgres`, err);
    return false;
  }
}

/**
 * Gracefully close all DB connections.
 */
export async function closeDbPool() {
  try {
    await pool.end();
    console.log(`${LOG_PREFIX} pool closed`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} pool close error`, err);
  }
}

/**
 * Helper to run a function inside a transaction safely.
 * Automatically commits or rolls back.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- Transaction with retry ---------- */

/**
 * Runs the provided callback inside a DB transaction, retrying on transient failures.
 *
 * @param callback async function that accepts a connected client and performs transactional work
 * @param opts.maxRetries maximum attempts (default 3)
 * @param opts.baseDelayMs base backoff in ms (default 200ms)
 */
export async function runTransactionWithRetries<T>(
 callback: (client: any) => Promise<T>,
 opts: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
 const maxRetries = opts.maxRetries ?? 3;
 const baseDelayMs = opts.baseDelayMs ?? 200;

 let attempt = 0;
 while (true) {
   attempt += 1;
   try {
     // withTransaction handles BEGIN/COMMIT/ROLLBACK and client release
     return await withTransaction(callback);
   } catch (err) {
     const isLastAttempt = attempt > maxRetries;
     if (isLastAttempt) {
       throw err;
     }
     // Exponential backoff with jitter
     const backoff = baseDelayMs * Math.pow(2, attempt - 1);
     const jitter = Math.floor(Math.random() * baseDelayMs);
     const delay = Math.min(backoff + jitter, 5000); // cap delay to 5s

     console.warn(
       `${LOG_PREFIX} transaction attempt ${attempt}/${maxRetries} failed — retrying in ${delay}ms`,
       (err as Error).message ?? err
     );
     await sleep(delay);
     // loop and retry
   }
 }
}

function sleep(ms: number) {
 return new Promise((resolve) => setTimeout(resolve, ms));
}