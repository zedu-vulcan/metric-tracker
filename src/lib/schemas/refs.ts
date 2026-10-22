import { z } from "@/lib/zod";

export const refKindValues = ["task"] as const;

export const refParamsSchema = z
  .object({
    ref: z.string().openapi({
      param: { name: "ref", in: "path" },
      description: "A short task reference like T-341. Case and the dash are optional.",
      example: "T-341",
    }),
  })
  .openapi("RefParams");

export const refItemSchema = z
  .object({
    kind: z.enum(refKindValues),
    ref: z.string(),
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    url: z.string().openapi({ description: "The page for people." }),
    apiPath: z.string().openapi({ description: "Where to read the full record with your agent key." }),
  })
  .openapi("RefItem");
