// src/routes/approvals.ts
import { Router } from "express";
import { publishApproval } from "../services/forwarderService.js";

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

export default router;
