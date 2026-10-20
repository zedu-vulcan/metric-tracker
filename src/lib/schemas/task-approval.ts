import { z } from "@/lib/zod";
import { commentItemSchema } from "@/lib/schemas/comments";

export const approvableTaskStatuses = ["submitted", "in_review"] as const;

export const taskApproveSchema = z
  .object({
    title: z.string().trim().max(200).nullable().optional(),
    body: z
      .string()
      .trim()
      .min(1, "Approval body cannot be empty")
      .max(10000)
      .optional()
      .default("Task deliverable approved."),
    tag: z.string().trim().max(50).nullable().optional(),
  })
  .openapi("TaskApprove");

export const taskApprovalResponseSchema = z
  .object({
    id: z.string(),
    status: z.literal("approved"),
    done: z.boolean(),
    completedAt: z.iso.datetime(),
    comment: commentItemSchema,
  })
  .openapi("TaskApprovalResponse");

