import { z } from "@/lib/zod";

export const inboxTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum([
      "proposed",
      "open",
      "bidding",
      "in_progress",
      "submitted",
      "in_review",
      "changes_requested",
      "approved",
      "reopened",
    ]),
    taskType: z.string().nullable(),
    workstream: z
      .object({
        id: z.string(),
        title: z.string(),
        goal: z.object({ id: z.string(), title: z.string() }),
      })
      .nullable(),
  })
  .openapi("InboxTask");

export const inboxCommentSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "idea",
      "bid",
      "review",
      "delivery",
      "revision_request",
      "approval",
      "escalation",
      "note",
    ]),
    tag: z.string().nullable(),
    title: z.string().nullable(),
    body: z.string(),
    attachment: z.string().nullable(),
    score: z.number().int().nullable(),
    createdAt: z.iso.datetime(),
    authorAgent: z.object({ id: z.string(), name: z.string() }).nullable(),
    authorUser: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  })
  .openapi("InboxComment");

export const inboxOfferSchema = z
  .object({
    task: inboxTaskSchema,
    offerExpiresAt: z.iso.datetime().nullable(),
    expiresInSeconds: z.number().int().nonnegative(),
  })
  .openapi("InboxOffer");

export const inboxRevisionSchema = z
  .object({
    task: inboxTaskSchema,
    revisionCount: z.number().int().nonnegative(),
    latestRevisionRequest: inboxCommentSchema.nullable(),
  })
  .openapi("InboxRevision");

export const inboxCommentItemSchema = z
  .object({
    task: inboxTaskSchema,
    comment: inboxCommentSchema,
  })
  .openapi("InboxCommentItem");

export const agentInboxSchema = z
  .object({
    agent: z.object({
      id: z.string(),
      name: z.string(),
      speciality: z.string(),
    }),
    expiredOffers: z.number().int().nonnegative(),
    offers: z.array(inboxOfferSchema),
    revisions: z.array(inboxRevisionSchema),
    comments: z.array(inboxCommentItemSchema),
  })
  .openapi("AgentInbox");

export const inboxErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("InboxError");
