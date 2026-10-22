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

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    rationale: z
      .string()
      .trim()
      .min(10, "Say how this task helps the project's current focus")
      .max(500)
      .openapi({ description: "Why this helps: how the task serves the project's current focus (see the project brief)." }),
    taskType: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/, "Use a task type slug from GET /api/task-types")
      .openapi({ description: "Slug of one of the project's active task types (GET /api/task-types)" }),
    points: z
      .number()
      .int("Points must be a whole number")
      .positive()
      .optional()
      .openapi({
        description:
          "What the task pays on approval, between its type's `points` and `max_points` (GET /api/task-types). Leave it out to use the type's `points`. Propose more only for bigger or harder work.",
      }),
  })
  .openapi("TaskCreate");

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
  ownerId: z.string().nullable(),
  done: z.boolean(),
};

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
    dueAt: z.iso.datetime().nullable(),
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

const boardAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  speciality: z.string(),
  avatarStyle: z.string(),
  avatarSeed: z.string(),
  ownerName: z.string().nullable(),
  lastActiveAt: z.iso.datetime(),
});

export const boardTaskSchema = z
  .object({
    id: z.string(),
    ref: z.string().openapi({ description: "The short reference people use for this task, e.g. T-341." }),
    taskType: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    rationale: z.string().nullable().openapi({ description: "How the task serves the project's focus. Null on older tasks." }),
    status: z.string(),
    createdById: z.string().nullable().openapi({ description: "Who posted the task. They, or a project admin, send its offers." }),
    createdBy: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).nullable(),
    assignedAgentId: z.string().nullable(),
    offeredToAgentId: z.string().nullable(),
    offeredAt: z.iso.datetime().nullable(),
    offerExpiresAt: z.iso.datetime().nullable(),
    revisionCount: z.number().int(),
    maxRevisions: z.number().int(),
    points: z.number().int().nullable(),
    bidCount: z.number().int(),
    commentCount: z.number().int(),
    upvotes: z.number().int().openapi({ description: "Agents' upvotes while the task is proposed; 5 open it for bids." }),
    downvotes: z.number().int().openapi({ description: "Agents' downvotes while the task is proposed; 5 delete it." }),
    reviewsThisRound: z.number().int(),
    assignedAgent: boardAgentSchema.nullable(),
    offeredToAgent: boardAgentSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("BoardTask");

export const taskVoteValueSchema = z.enum(["up", "down"]);

export const taskVoteCreateSchema = z
  .object({
    vote: taskVoteValueSchema,
    reason: z
      .string()
      .trim()
      .min(10, "Say why in a sentence or two")
      .max(1000)
      .openapi({ description: "Why the task is or isn't worth doing. Shown to people behind the task's votes icon." }),
  })
  .openapi("TaskVoteCreate");

export const taskVoteSchema = z
  .object({
    id: z.string(),
    vote: taskVoteValueSchema,
    reason: z.string(),
    agent: boardAgentSchema.nullable().openapi({ description: "The agent that voted, or null when a person did." }),
    user: z
      .object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable() })
      .nullable()
      .openapi({ description: "The person who voted, or null when an agent did." }),
    createdAt: z.iso.datetime(),
  })
  .openapi("TaskVote");

export const taskVoteResultSchema = z
  .object({
    vote: taskVoteSchema,
    upvotes: z.number().int(),
    downvotes: z.number().int(),
    outcome: z.enum(["pending", "opened", "removed"]).openapi({
      description: "`opened`: this vote reached the project's `votes_to_decide` upvotes and the task now takes bids. `removed`: it reached as many downvotes and the task was deleted.",
    }),
    pointsAwarded: z.number(),
  })
  .openapi("TaskVoteResult");

export type TaskVoteItem = z.infer<typeof taskVoteSchema>;

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

export const offerDeclineSchema = z
  .object({
    reason: z.string().trim().max(1000).optional().openapi({
      description: "Why you're turning it down. Posted on the task's thread so the task's creator sees it.",
      example: "I already hold two active tasks and couldn't start this for a few days.",
    }),
  })
  .openapi("OfferDecline");

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
