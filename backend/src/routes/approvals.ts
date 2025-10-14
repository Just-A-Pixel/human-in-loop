// src/routes/approvals.ts
import { Router } from "express";
import { getAllRequests, publishApproval } from "../services/forwarderService.js";
import { performApprovalAction } from "../services/approvalActionsService.js";
import { getApprovalStatus } from "../services/approvalQueryService.js";

const router = Router();

router.post("/approval", async (req, res, next) => {
  try {
    const producer = req.app.locals.producer;
    const result = await publishApproval({ producer, envelopeBody: req.body });

    return res.status(result.accepted ? 202 : 503).json(result.payload);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /getAllRequests?userId=alice
 *
 * Note: this route expects the query param `userId` which is treated as the approver name
 * (maps to approvals.approver_name). If you want to use UUID user_id instead, we should
 * look up the username from users table first and then call getAllRequests.
 */
router.post("/getAllRequests", async (req, res, next) => {
  try {
    const userId = (req.query.userId as string) ?? (req.body?.userId as string);

    if (!userId) {
      return res.status(400).json({ ok: false, message: "Missing query param: userId" });
    }

    // call service
    const result = await getAllRequests({ approverName: userId });

    if (!result.ok) {
      // internal error fetching approvals
      return res.status(500).json({ ok: false, message: "Failed to fetch approvals", detail: String(result.error) });
    }

    // successful: return approvals array
    return res.status(200).json({ ok: true, approvals: result.approvals });
  } catch (err) {
    next(err);
  }
});

// POST /api/approval/:contextId/action
router.post("/approval/:contextId/action", async (req, res, next) => {
  try {
    const contextId = req.params.contextId;
    const { action, actor, notes } = req.body ?? {};

    if (!contextId) return res.status(400).json({ ok: false, message: "missing contextId" });
    if (!["approve", "deny", "rollback"].includes(action)) {
      return res.status(400).json({ ok: false, message: "invalid action" });
    }

    const result = await performApprovalAction({ contextId, action, actor, notes });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/approval/:contextId/status
router.get("/approval/:contextId/status", async (req, res, next) => {
  try {
    const contextId = req.params.contextId;
    if (!contextId) return res.status(400).json({ ok: false, message: "missing contextId" });

    const result = await getApprovalStatus(contextId);

    if (!result.ok) {
      if (result.code === "not_found" || result.error === "not_found") {
        return res.status(404).json({ ok: false, message: "not_found" });
      }
      // internal error
      return res.status(500).json({ ok: false, message: "internal_error", detail: String(result.error) });
    }

    return res.status(200).json({ ok: true, ...result.data });
  } catch (err) {
    next(err);
  }
});

export default router;
