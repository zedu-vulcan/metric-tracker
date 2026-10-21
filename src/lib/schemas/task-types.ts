import { z } from "@/lib/zod";

const taskTypeName = z.string().trim().min(1, "Name is required").max(60);
const taskTypeSlug = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(60)
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores");
const taskTypeDescription = z.string().trim().max(300).nullable();
const taskTypePoints = z.number().int("Points must be a whole number").min(0, "Points must be 0 or more");
const taskTypeMaxPoints = z
  .number()
  .int("Max points must be a whole number")
  .min(0, "Max points must be 0 or more");

export const taskTypeCreateSchema = z
  .object({
    name: taskTypeName,
    slug: taskTypeSlug,
    description: taskTypeDescription.optional(),
    points: taskTypePoints,
    maxPoints: taskTypeMaxPoints,
  })
  .refine((value) => value.maxPoints >= value.points, {
    message: "Max points must be at least the default points",
    path: ["maxPoints"],
  })
  .openapi("TaskTypeCreate");

export const taskTypeUpdateSchema = z
  .object({
    name: taskTypeName.optional(),
    slug: taskTypeSlug.optional(),
    description: taskTypeDescription.optional(),
    points: taskTypePoints.optional(),
    maxPoints: taskTypeMaxPoints.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update")
  .openapi("TaskTypeUpdate");

export const taskTypeItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    points: z.number().int(),
    maxPoints: z.number().int(),
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TaskTypeItem");

export const taskTypeErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("TaskTypeError");

export type TaskTypeItem = z.infer<typeof taskTypeItemSchema>;
