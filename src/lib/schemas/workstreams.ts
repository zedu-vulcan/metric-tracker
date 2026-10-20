import { z } from "@/lib/zod";

export const workstreamStatusValues = ["proposed", "accepted", "rejected"] as const;
export const workstreamStatusSchema = z.enum(workstreamStatusValues);

export const goalTypeValues = ["seo", "content", "marketing", "research", "outreach"] as const;
export const goalTypeSchema = z.enum(goalTypeValues);

export const goalStatusValues = ["active", "completed", "archived"] as const;
export const goalStatusSchema = z.enum(goalStatusValues);

export const workstreamTaskStatusValues = [
  "proposed",
  "open",
  "bidding",
  "in_progress",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "reopened",
] as const;
export const workstreamTaskStatusSchema = z.enum(workstreamTaskStatusValues);

export const workstreamQuerySchema = z.object({
  goalId: z.string().trim().min(1).optional(),
  status: workstreamStatusSchema.optional().default("accepted"),
});

export const workstreamAutoAcceptSchema = z
  .object({
    autoAcceptTasks: z.boolean().optional(),
  })
  .openapi("WorkstreamAutoAccept");

export const workstreamTaskSummarySchema = z
  .object({
    id: z.string(),
    workstreamId: z.string().nullable(),
    taskType: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: workstreamTaskStatusSchema,
    assignedAgentId: z.string().nullable(),
    offeredToAgentId: z.string().nullable(),
    offeredAt: z.iso.datetime().nullable(),
    offerExpiresAt: z.iso.datetime().nullable(),
    revisionCount: z.number().int(),
    maxRevisions: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("WorkstreamTaskSummary");

export const workstreamItemSchema = z
  .object({
    id: z.string(),
    goalId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: workstreamStatusSchema,
    autoAcceptTasks: z.boolean(),
    proposedByAgentId: z.string().nullable(),
    acceptedById: z.string().nullable(),
    taskCount: z.number().int(),
    goal: z.object({
      id: z.string(),
      title: z.string(),
      type: goalTypeSchema,
      status: goalStatusSchema,
    }),
    proposedByAgent: z
      .object({
        id: z.string(),
        name: z.string(),
        speciality: z.string(),
      })
      .nullable()
      .optional(),
    acceptedBy: z
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
  .openapi("WorkstreamItem");

export const workstreamDetailSchema = workstreamItemSchema
  .extend({
    goal: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      type: goalTypeSchema,
      status: goalStatusSchema,
    }),
    tasks: workstreamTaskSummarySchema.array(),
  })
  .openapi("WorkstreamDetail");

export const workstreamAutoAcceptResponseSchema = z
  .object({
    id: z.string(),
    goalId: z.string(),
    title: z.string(),
    status: workstreamStatusSchema,
    autoAcceptTasks: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("WorkstreamAutoAcceptResponse");

export const workstreamErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("WorkstreamError");

