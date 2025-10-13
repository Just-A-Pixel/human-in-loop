import { z } from "zod";

// Define schemas
export const ActionSchema = z.object({
  action_id: z.string().uuid().optional(),
  type: z.enum(["http", "other"]).default("http"),
  method: z.string().optional().default("POST"),
  url: z.string().url({ message: "Invalid URL" }),
  body: z.any().optional(),
  description: z.string().optional(),
});

export const SnapshotSchema = z.object({
  context_id: z.string().min(1, "snapshot.context_id required"),
  turns: z.array(z.any()).optional(),
  variables: z.record(z.string(), z.any()).optional(),
  plan: z.array(z.any()).optional(),
  timestamp: z.string().optional(),
});

export const ApprovalEnvelopeSchema = z.object({
  session_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  approver: z.string(),
  ui_schema: z.record(z.string(), z.any()).optional(),
  snapshot: SnapshotSchema,
  actions: z.array(ActionSchema).nonempty("At least one action required"),
  rollback_actions: z.array(ActionSchema).optional(),
  deadline: z.string().optional(),
});

// Export TS type for free
export type ApprovalEnvelope = z.infer<typeof ApprovalEnvelopeSchema>;