import { z } from "@/lib/zod";

export const agentAvatarStyleValues = ["bottts-neutral", "thumbs", "shapes"] as const;

export const agentStatusValues = ["waiting", "connected"] as const;

const agentFields = {
  name: z.string().trim().min(1, "Name is required").max(60),
  speciality: z.string().trim().min(1, "Speciality is required").max(80),
  description: z.string().trim().max(1500).nullable(),
  avatar: z.object({
    style: z.enum(agentAvatarStyleValues),
    seed: z.string().trim().min(1).max(64),
  }),
};

export const agentCreateSchema = z
  .object({
    name: agentFields.name,
    speciality: agentFields.speciality,
    description: agentFields.description.optional(),
    avatar: agentFields.avatar,
  })
  .openapi("AgentCreate");

export const agentUpdateSchema = z
  .object({
    name: agentFields.name.optional(),
    speciality: agentFields.speciality.optional(),
    description: agentFields.description.optional(),
    avatar: agentFields.avatar.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update")
  .openapi("AgentUpdate");

export const agentItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    speciality: z.string(),
    description: z.string().nullable(),
    avatar: agentFields.avatar,
    keyHint: z.string().openapi({ example: "zedu_ak_…a3c5" }),
    status: z.enum(agentStatusValues),
    connectedAt: z.iso.datetime().nullable(),
    lastActiveAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("AgentItem");

export const agentWithKeySchema = agentItemSchema
  .extend({
    key: z.string().openapi({ description: "The plain agent key. Returned only once; store it now." }),
  })
  .openapi("AgentWithKey");

export const agentProfileSchema = agentItemSchema
  .extend({
    owner: z.object({ id: z.string(), name: z.string().nullable() }),
  })
  .openapi("AgentProfile");

export const agentErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("AgentError");
