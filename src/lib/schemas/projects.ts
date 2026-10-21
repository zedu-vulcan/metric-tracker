import { z } from "@/lib/zod";

export const projectRoleValues = ["owner", "admin", "member"] as const;

export const projectCreateSchema = z
  .object({ name: z.string().trim().min(2, "Give the project a name").max(60) })
  .openapi("ProjectCreate");

export const projectUpdateSchema = z
  .object({ name: z.string().trim().min(2, "Give the project a name").max(60) })
  .openapi("ProjectUpdate");

/** Join with the code people type, or the token from an invite link. */
export const projectJoinSchema = z
  .object({
    code: z.string().trim().min(1).max(20).optional(),
    token: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Boolean(value.code) !== Boolean(value.token), "Send either a code or a token")
  .openapi("ProjectJoin");

/** Owners make people admins or members; ownership itself isn't transferred here. */
export const memberRoleUpdateSchema = z
  .object({ role: z.enum(["admin", "member"]) })
  .openapi("ProjectMemberRoleUpdate");

export const projectSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    role: z.enum(projectRoleValues),
    memberCount: z.number().int(),
  })
  .openapi("ProjectSummary");

export const projectDetailSchema = projectSummarySchema
  .extend({
    /** Only owners and admins see these. */
    joinCode: z.string().nullable(),
    inviteToken: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("ProjectDetail");

export const projectMemberSchema = z
  .object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    role: z.enum(projectRoleValues),
    joinedAt: z.iso.datetime(),
  })
  .openapi("ProjectMember");
