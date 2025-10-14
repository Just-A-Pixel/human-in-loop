// src/queries.ts

/**
 * Centralized SQL query strings.
 * Keeps materializer logic readable and avoids repeating SQL literals.
 */

export const QUERIES = {
 /** Inserts new event into audit log */
 INSERT_EVENT: `
   INSERT INTO events (context_id, type, payload, actor, created_at)
   VALUES ($1, $2, $3, $4, NOW());
 `,

 /** Inserts or updates approval request (upsert by context_id) */
 UPSERT_APPROVAL_REQUEST: `
   INSERT INTO approvals (
     context_id, approver_name, title, deadline,
     turns, snapshot, status, created_at, updated_at
   )
   VALUES (
     $1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW()
   )
   ON CONFLICT (context_id) DO UPDATE
     SET snapshot = EXCLUDED.snapshot,
         approver_name = COALESCE(EXCLUDED.approver_name, approvals.approver_name),
         title = COALESCE(EXCLUDED.title, approvals.title),
         deadline = COALESCE(EXCLUDED.deadline, approvals.deadline),
         turns = COALESCE(EXCLUDED.turns, approvals.turns),
         status = 'pending',
         updated_at = NOW();
 `,

 /** Updates approval status when a human response is received */
 UPDATE_APPROVAL_STATUS: `
   UPDATE approvals
   SET status = $1, updated_at = NOW()
   WHERE context_id = $2;
 `,

 /**
   * Select approvals by approver name or user_id.
   *
   * Parameters:
   *   $1 = approver_name (text)
   *   $2 = LIMIT (optional)
   *   $3 = OFFSET (optional)
   *
   * This can be used with or without pagination.
   */
 SELECT_APPROVALS_BY_APPROVER: `
 SELECT
   a.context_id,
   a.approver_name,
   a.title,
   a.deadline,
   a.turns,
   a.snapshot,
   a.status,
   a.created_at,
   a.updated_at
 FROM approvals a
 WHERE a.approver_name = $1
 AND a.status IN ('pending', 'approval_requested')
 ORDER BY a.created_at DESC
 LIMIT COALESCE($2::int, 100)
 OFFSET COALESCE($3::int, 0);
`,

/** Read approval (by context_id) */
SELECT_APPROVAL_BY_CONTEXT: `
SELECT context_id, approver_name, title, deadline, turns, snapshot, status, created_at, updated_at
FROM approvals
WHERE context_id = $1
LIMIT 1;
`,

};
