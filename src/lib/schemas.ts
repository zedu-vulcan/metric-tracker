import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const ListBodySchema = z.object({
  name: z.string().min(1, "Name is required").openapi({ example: "Product Directories" }),
});

export const DirectoryBodySchema = z.object({
  name: z.string().min(1, "Name is required").openapi({ example: "Product Hunt" }),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")).openapi({ example: "https://www.producthunt.com" }),
  listId: z.string().min(1, "listId is required").openapi({ example: "clxxxxxxxxxxxxxxxx" }),
});

export const SubmissionStatusSchema = z
  .enum(["planned", "submitted", "live", "rejected"])
  .openapi({ example: "planned" });

export const CreateSubmissionBodySchema = z.object({
  directoryId: z.string().min(1, "directoryId is required").openapi({ example: "clxxxxxxxxxxxxxxxx" }),
  status: SubmissionStatusSchema.optional().default("planned"),
  submittedAt: z.string().datetime().nullable().optional().openapi({ example: "2026-10-15T00:00:00Z" }),
  listingUrl: z.string().url().nullable().optional().openapi({ example: "https://www.producthunt.com/posts/my-product" }),
});

export const UpdateSubmissionBodySchema = z.object({
  status: SubmissionStatusSchema.optional(),
  listingUrl: z.string().url().nullable().optional().openapi({ example: "https://www.producthunt.com/posts/my-product" }),
  submittedAt: z.string().datetime().nullable().optional().openapi({ example: "2026-10-15T00:00:00Z" }),
});

export const TrafficBodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .openapi({ example: "2026-10-15" }),
  visits: z.number().int().nonnegative().openapi({ example: 1200 }),
});
