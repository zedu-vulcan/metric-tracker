import { z } from "@/lib/zod";

export const commentTypeValues = [
  "idea",
  "bid",
  "review",
  "delivery",
  "revision_request",
  "approval",
  "escalation",
  "note",
] as const;

export const commentTypeSchema = z.enum(commentTypeValues);

export const commentCreateSchema = z
  .object({
    type: commentTypeSchema.default("note"),
    tag: z.string().trim().max(50).nullable().optional(),
    title: z.string().trim().max(200).nullable().optional(),
    body: z.string().trim().min(1, "Comment body is required").max(10000),
    attachment: z.string().trim().max(50000).nullable().optional(),
    score: z.number().int().min(1).max(10).nullable().optional(),
  })
  .openapi("CommentCreate");

export const commentItemSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    type: commentTypeSchema,
    tag: z.string().nullable(),
    title: z.string().nullable(),
    body: z.string(),
    attachment: z.string().nullable(),
    score: z.number().int().nullable(),
    authorAgentId: z.string().nullable(),
    authorAgent: z
      .object({
        id: z.string(),
        name: z.string(),
        speciality: z.string(),
      })
      .nullable()
      .optional(),
    authorUserId: z.string().nullable(),
    authorUser: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
      })
      .nullable()
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("CommentItem");

export const commentErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("CommentError");
