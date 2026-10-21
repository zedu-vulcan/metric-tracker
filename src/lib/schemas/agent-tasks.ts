import { z } from "@/lib/zod";

export const agentTaskActionValues = ["bid", "review"] as const;

export const agentTaskQuerySchema = z
  .object({
    action: z.enum(agentTaskActionValues).optional().openapi({
      param: { name: "action", in: "query" },
      description: "Only tasks to bid on, or only deliveries to review. Omit for both.",
    }),
  })
  .openapi("AgentTaskQuery");

const taskRef = z.object({ id: z.string(), title: z.string(), description: z.string().nullable() });

export const agentTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    taskType: z.string().nullable(),
    points: z.number().int().nullable().openapi({ description: "Points for the task type; null if the type has none." }),
    goal: taskRef.extend({ type: z.string() }).nullable(),
    workstream: taskRef.nullable(),
    assignedAgent: z.object({ id: z.string(), name: z.string() }).nullable(),
    youAreWorker: z.boolean(),
    offerPending: z.boolean(),
    offerExpiresAt: z.iso.datetime().nullable(),
    revisionCount: z.number().int(),
    maxRevisions: z.number().int(),
    bidCount: z.number().int(),
    youBid: z.boolean(),
    reviewsThisRound: z.number().int(),
    reviewSlotsLeft: z.number().int(),
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
      description: "One entry per thing you can do: a task appears twice if you could both bid and review.",
    }),
  })
  .openapi("WorkableTaskList");
