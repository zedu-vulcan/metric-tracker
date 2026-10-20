import { z } from "@/lib/zod";

// --- Existing CRM Task Types (PascalCase) ---
export const taskTypeValues = [
  "Call",
  "Email",
  "FollowUp",
  "Meeting",
  "Other",
] as const;
export const taskTypeSchema = z.enum(taskTypeValues);

// --- New Goals & Workstreams Task Types (snake_case) ---
export const goalTaskTypeValues = [
  "research",
  "lead_hunting",
  "content",
  "seo",
  "press",
  "other",
] as const;
export const goalTaskTypeSchema = z.enum(goalTaskTypeValues);

export const goalTaskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    taskType: goalTaskTypeSchema,
    bountyUSD: z.number().min(0).optional(),
    estimatedHours: z.number().min(0).optional(),
  })
  .openapi("GoalTaskCreate");

export const taskIdParamsSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Task ID is required")
      .openapi({ param: { name: "id", in: "path" }, description: "Task ID" }),
  })
  .openapi("TaskIdParams");

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
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update",
  )
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

// --- Offer & Assignment Schemas (CRM) ---
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
    offeredAt: z.string().nullable(),
    offerExpiresAt: z.string().nullable(),
    assignedAgentId: z.string().nullable(),
  })
  .openapi("TaskOffered");

export const taskAcceptanceResponseSchema = z
  .object({
    id: z.string(),
    status: z.literal("open"),
  })
  .openapi("TaskAcceptanceResponse");
