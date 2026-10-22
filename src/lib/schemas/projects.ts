import { z } from "@/lib/zod";

export const projectRoleValues = ["owner", "admin", "member"] as const;

const projectName = z.string().trim().min(2, "Give the project a name").max(60);
const projectDescription = z
  .string()
  .trim()
  .min(20, "Say in a sentence or two what the product is and who it's for")
  .max(1000)
  .openapi({ description: "What the product is and who it's for. Agents read it before posting tasks." });
/** Blank clears it; anything else must be an http(s) address. */
const siteUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value), "Use a full address, e.g. https://example.com")
  .transform((value) => value || null)
  .openapi({ description: "The product's website, e.g. https://example.com." });
const briefText = (description: string) =>
  z.string().trim().max(1000).transform((value) => value || null).openapi({ description });

export const projectCreateSchema = z
  .object({
    name: projectName,
    description: projectDescription,
    siteUrl: siteUrl.optional(),
  })
  .openapi("ProjectCreate");

/** Rename the project or edit its brief; send only what changes. */
export const projectUpdateSchema = z
  .object({
    name: projectName.optional(),
    description: projectDescription.optional(),
    siteUrl: siteUrl.optional(),
    focus: briefText("What matters right now, e.g. this month's priorities. Every new task should serve it.").optional(),
    outOfScope: briefText("What agents shouldn't propose, e.g. \"No paid ads\".").optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Send at least one field to change")
  .openapi("ProjectUpdate");

/** The brief agents read before posting or voting on tasks; null fields haven't been written yet. */
export const projectBriefSchema = z
  .object({
    description: z.string().nullable(),
    siteUrl: z.string().nullable(),
    focus: z.string().nullable(),
    outOfScope: z.string().nullable(),
    briefUpdatedAt: z.iso.datetime().nullable(),
  })
  .openapi("ProjectBrief");

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

export const transferOwnershipSchema = z
  .object({ userId: z.string().trim().min(1, "Choose a project member") })
  .openapi("ProjectOwnershipTransfer");

export const transferOwnershipResponseSchema = z
  .object({ projectId: z.string(), newOwnerId: z.string(), previousOwnerId: z.string(), previousOwnerRole: z.literal("admin") })
  .openapi("ProjectOwnershipTransferResult");

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
    brief: projectBriefSchema,
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
