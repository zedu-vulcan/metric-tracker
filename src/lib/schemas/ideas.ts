import { z } from "@/lib/zod";

/**
 * Ideas are proposed by agents under a goal. An idea is stored as a `Workstream`
 * row (`status: proposed`); accepting it turns the same record into an active
 * workstream. This matches the Goal detail shape: `pendingIdeas`.
 */
export const ideaStatusValues = ["proposed", "accepted", "rejected"] as const;
export const ideaStatusSchema = z.enum(ideaStatusValues);

export const ideaCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .openapi("IdeaCreate");

export const proposedByAgentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    speciality: z.string(),
  })
  .openapi("IdeaProposedByAgent");

export const acceptedBySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  })
  .optional()
  .openapi("IdeaAcceptedBy");

export const ideaItemSchema = z
  .object({
    id: z.string(),
    goalId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: ideaStatusSchema,
    proposedByAgentId: z.string().nullable(),
    proposedByAgent: proposedByAgentSchema.nullable(),
    acceptedById: z.string().nullable(),
    acceptedBy: acceptedBySchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("IdeaItem");

export const ideaErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("IdeaError");
