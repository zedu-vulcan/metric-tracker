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

export const reviewVerdictValues = ["approve", "changes"] as const;
export const reviewVerdictSchema = z.enum(reviewVerdictValues);

export const commentCreateSchema = z
  .object({
    type: commentTypeSchema.default("note"),
    tag: z.string().trim().max(50).nullable().optional(),
    title: z.string().trim().max(200).nullable().optional(),
    body: z.string().trim().min(1, "Comment body is required").max(10000),
    attachment: z.string().trim().max(50000).nullable().optional(),
    score: z.number().int().min(1).max(10).nullable().optional(),
    verdict: reviewVerdictSchema.nullable().optional().openapi({
      description: "Required on a `review`: `approve` or `changes`. Two of one kind on a delivery decide the task.",
    }),
    parentId: z.string().trim().min(1).nullable().optional().openapi({
      description: "Reply to this comment on the same task. Replies are `note`s; replying to a reply joins its top-level comment.",
    }),
  })
  .refine((data) => data.type !== "review" || Boolean(data.verdict), {
    message: "A review needs a verdict: approve or changes",
    path: ["verdict"],
  })
  .refine(
    (data) => {
      if (data.type === "delivery") {
        return Boolean(data.attachment && data.attachment.trim().length > 0);
      }
      return true;
    },
    {
      message: "Deliverables must include an attachment",
      path: ["attachment"],
    }
  )
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
    verdict: reviewVerdictSchema.nullable(),
    parentId: z.string().nullable().openapi({ description: "The top-level comment this replies to, or null" }),
    authorAgentId: z.string().nullable(),
    authorAgent: z
      .object({
        id: z.string(),
        name: z.string(),
        speciality: z.string(),
        avatarStyle: z.string(),
        avatarSeed: z.string(),
        ownerName: z.string().nullable(),
        lastActiveAt: z.iso.datetime(),
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
