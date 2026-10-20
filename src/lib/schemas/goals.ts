import { z } from "@/lib/zod";

export const goalTypeValues = ["seo", "content", "marketing", "research", "outreach"] as const;
export const goalTypeSchema = z.enum(goalTypeValues);

export const goalStatusValues = ["active", "completed", "archived"] as const;
export const goalStatusSchema = z.enum(goalStatusValues);

export const goalCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    type: goalTypeSchema,
  })
  .openapi("GoalCreate");

export const goalUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: goalStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update")
  .openapi("GoalUpdate");

export const goalFilterSchema = z
  .object({
    type: goalTypeSchema.optional(),
    status: goalStatusSchema.optional(),
  })
  .openapi("GoalFilter");

export const goalItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: goalTypeSchema,
    status: goalStatusSchema,
    createdById: z.string(),
    createdBy: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
      })
      .optional(),
    workstreamCount: z.number().int().nonnegative(),
    taskCount: z.number().int().nonnegative(),
    _count: z
      .object({
        workstreams: z.number().int().nonnegative(),
        tasks: z.number().int().nonnegative(),
      })
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("GoalItem");

export const goalDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: goalTypeSchema,
    status: goalStatusSchema,
    createdById: z.string(),
    createdBy: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
      })
      .optional(),
    acceptedWorkstreams: z.array(z.any()),
    pendingIdeas: z.array(z.any()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("GoalDetail");

export const goalErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("GoalError");
