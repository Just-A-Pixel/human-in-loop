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

 /* NEW: select approvals by approver (with optional status); returns total count and rows */
 SELECT_APPROVALS_BY_APPROVER: `
 SELECT
   context_id,
   approver_name,
   title,
   deadline,
   turns,
   snapshot,
   status,
   created_at,
   updated_at
 FROM approvals
 WHERE approver_name = $1
 ORDER BY created_at DESC
`,

// To enable pagination
//  
//  LIMIT $2
//  OFFSET $3;


};
