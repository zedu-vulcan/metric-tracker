import { z } from "@/lib/zod";

export const refKindValues = ["goal", "idea", "task"] as const;

export const refParamsSchema = z
  .object({
    ref: z.string().openapi({
      param: { name: "ref", in: "path" },
      description: "A short reference: G-12 (goal), I-7 (idea or workstream) or T-341 (task). Case and the dash are optional.",
      example: "T-341",
    }),
  })
  .openapi("RefParams");

const parentSchema = z.object({ id: z.string(), ref: z.string(), title: z.string() });

export const refItemSchema = z
  .object({
    kind: z.enum(refKindValues),
    ref: z.string(),
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    goal: parentSchema.nullable().openapi({ description: "The goal an idea or task belongs to." }),
    idea: parentSchema.nullable().openapi({ description: "The workstream a task belongs to." }),
    url: z.string().nullable().openapi({ description: "The page for people; null for old tasks outside any workstream." }),
    apiPath: z.string().openapi({ description: "Where to read the full record with your agent key." }),
  })
  .openapi("RefItem");
