import { z } from "@/lib/zod";

export const taskTypeValues = ["Call", "Email", "FollowUp", "Meeting", "Other"] as const;

export const taskTypeSchema = z.enum(taskTypeValues);

const taskFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).nullable(),
  type: taskTypeSchema,
  dueAt: z.iso.datetime(),
  assignToMe: z.boolean(),
  ownerId: z.string().nullable(),
  done: z.boolean(),
};

export const taskCreateSchema = z
  .object({
    title: taskFields.title,
    description: taskFields.description.optional(),
    type: taskFields.type.default("Other"),
    dueAt: taskFields.dueAt,
    assignToMe: taskFields.assignToMe.default(true),
    ownerId: taskFields.ownerId.optional(),
  })
  .openapi("TaskCreate");

export const taskUpdateSchema = z
  .object({
    title: taskFields.title.optional(),
    description: taskFields.description.optional(),
    type: taskFields.type.optional(),
    dueAt: taskFields.dueAt.optional(),
    done: taskFields.done.optional(),
    ownerId: taskFields.ownerId.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update")
  .openapi("TaskUpdate");

export const taskItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: taskTypeSchema,
    dueAt: z.iso.datetime(),
    done: z.boolean(),
    completedAt: z.iso.datetime().nullable(),
    ownerId: z.string().nullable(),
    userId: z.string(),
    owner: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
      })
      .nullable()
      .optional(),
    user: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
      })
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TaskItem");

export const taskErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("TaskError");

export const offerCreateSchema = z
  .object({
    agentId: z.string().trim().min(1, "Agent ID is required"),
  })
  .openapi("OfferCreate");

export const offerAcceptSchema = z.object({}).openapi("OfferAccept");

export const taskOfferedSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    offeredToAgentId: z.string().nullable(),
    offeredAt: z.iso.datetime().nullable(),
    offerExpiresAt: z.iso.datetime().nullable(),
    assignedAgentId: z.string().nullable(),
  })
  .openapi("TaskOffered");

/**
 * Task lifecycle (Goals/Workstreams platform).
 *
 * A task proposed under an accepted workstream. `taskType` is a free-form
 * category (`research`, `lead_hunting`, `content`, `seo`, `press`, …) and
 * `status` follows the assignment/review state machine.
 */
export const workstreamTaskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    taskType: z.string().trim().min(1).max(50).optional(),
  })
  .openapi("WorkstreamTaskCreate");

export const taskStatusValues = [
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
export const taskStatusSchema = z.enum(taskStatusValues);

export const taskLifecycleItemSchema = z
  .object({
    id: z.string(),
    workstreamId: z.string().nullable(),
    taskType: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: taskStatusSchema,
    assignedAgentId: z.string().nullable(),
    assignedAgent: z
      .object({
        id: z.string(),
        name: z.string(),
        speciality: z.string(),
      })
      .nullable()
      .optional(),
    offeredToAgentId: z.string().nullable(),
    offeredAt: z.iso.datetime().nullable(),
    offerExpiresAt: z.iso.datetime().nullable(),
    revisionCount: z.number().int(),
    maxRevisions: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TaskLifecycleItem");

export const taskAcceptSchema = z.object({}).openapi("TaskAccept");

export const taskApproveSchema = z.object({}).openapi("TaskApprove");
