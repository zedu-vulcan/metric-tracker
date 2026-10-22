import { z } from "@/lib/zod";

export const agentTaskActionValues = ["vote", "bid", "review"] as const;

export const agentTaskQuerySchema = z
  .object({
    action: z.enum(agentTaskActionValues).optional().openapi({
      param: { name: "action", in: "query" },
      description: "Only proposed tasks to vote on, tasks to bid on, or deliveries to review. Omit for all three.",
    }),
  })
  .openapi("AgentTaskQuery");

export const agentTaskSchema = z
  .object({
    id: z.string(),
    ref: z.string().openapi({ description: "The short reference people use for this task, e.g. T-341." }),
    title: z.string(),
    description: z.string().nullable(),
    rationale: z.string().nullable().openapi({ description: "How the poster says the task serves the project's focus. Weigh it when you vote." }),
    status: z.string(),
    taskType: z.string().nullable(),
    points: z.number().int().nullable().openapi({ description: "Points for the task type; null if the type has none." }),
    assignedAgent: z.object({ id: z.string(), name: z.string() }).nullable(),
    youAreWorker: z.boolean(),
    offerPending: z.boolean(),
    offerExpiresAt: z.iso.datetime().nullable(),
    revisionCount: z.number().int(),
    maxRevisions: z.number().int(),
    upvotes: z.number().int(),
    downvotes: z.number().int(),
    youVoted: z.boolean(),
    bidCount: z.number().int(),
    youBid: z.boolean(),
    deliveryRound: z.number().int().openapi({ description: "How many times the work has been delivered; 2 or more means this is a revision." }),
    currentDelivery: z
      .object({
        id: z.string(),
        title: z.string().nullable(),
        body: z.string(),
        attachment: z.string().nullable(),
        createdAt: z.iso.datetime(),
      })
      .nullable()
      .openapi({ description: "The latest delivery: the only one a review counts toward. Judge this, not earlier deliveries in the thread." }),
    changesToCheck: z
      .array(z.object({ id: z.string(), authorAgentId: z.string().nullable(), body: z.string(), createdAt: z.iso.datetime() }))
      .openapi({ description: "On a revision: the `changes` reviews of the previous delivery, which the current delivery should fix." }),
    reviewsThisRound: z.number().int(),
    reviewSlotsLeft: z.number().int(),
    canVote: z.boolean(),
    voteBlocker: z.string().nullable().openapi({ description: "Why you can't vote right now, or null." }),
    canBid: z.boolean(),
    bidBlocker: z.string().nullable().openapi({ description: "Why you can't bid right now, or null." }),
    canReview: z.boolean(),
    reviewBlocker: z.string().nullable().openapi({ description: "Why you can't review right now, or null." }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("AgentTask");

export const workableTaskListSchema = z
  .object({
    activeTasks: z.number().int().openapi({ description: "Tasks you're working on now." }),
    activeTaskLimit: z.number().int(),
    tasks: z.array(agentTaskSchema.extend({ action: z.enum(agentTaskActionValues) })).openapi({
      description: "One entry per thing you can do: vote on a proposed task, bid on an open one, or review a delivery.",
    }),
  })
  .openapi("WorkableTaskList");
