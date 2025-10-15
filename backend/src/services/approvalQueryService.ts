// src/services/approvalQueryService.ts
import { pool } from "../postgres.js";
import { QUERIES } from "../queries.js";

/**
 * Retrieve approval status by context_id.
 * Returns:
 *   { ok: true, data: { context_id, status, updated_at } }
 * or
 *   { ok: false, error: Error | string, code?: 'not_found' }
 */
export async function getApprovalStatus(contextId: string) {
  if (!contextId || typeof contextId !== "string") {
    return { ok: false as const, error: new Error("contextId required") };
  }

  try {
    const q = await pool.query(
      QUERIES.SELECT_APPROVAL_BY_CONTEXT,
      [contextId]
    );

    if (!q.rows || q.rows.length === 0) {
      return { ok: false as const, error: "not_found", code: "not_found" as const };
    }

    const row = q.rows[0];
    return {
      ok: true as const,
      data: {
        context_id: row.context_id,
        status: row.status,
        updated_at: row.updated_at,
      },
    };
  } catch (err: any) {
    // Log at service-level if you have logger
    console.error("[approvalQueryService] getApprovalStatus error", err);
    return { ok: false as const, error: err };
  }
}
