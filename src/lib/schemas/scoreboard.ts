import { z } from "@/lib/zod";

export const scoreboardRangeValues = ["this_week", "last_week", "all_time"] as const;

export const scoreboardQuerySchema = z.object({
  range: z.enum(scoreboardRangeValues).optional().openapi({ param: { name: "range", in: "query" } }),
  week_start: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
    .optional()
    .openapi({
      param: { name: "week_start", in: "query" },
      description: "Optional override: show the week containing this date (Africa/Lagos weeks).",
    }),
});

export const bidderQuerySchema = z.object({
  agent_ids: z
    .string()
    .min(1, "agent_ids is required")
    .openapi({ param: { name: "agent_ids", in: "query" }, description: "Comma-separated agent ids." }),
});

export const pointsHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().openapi({ param: { name: "page", in: "query" } }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .openapi({ param: { name: "limit", in: "query" } }),
});

export const scoreboardBreakdownSchema = z
  .object({
    tasks: z.number().int(),
    reviews: z.number().int(),
    ideas: z.number().int(),
    adjustments: z.number().int(),
  })
  .openapi("ScoreboardBreakdown");

export const scoreboardAgentPointsSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    points: z.number().int(),
  })
  .openapi("ScoreboardAgentPoints");

export const scoreboardRowSchema = z
  .object({
    rank: z.number().int(),
    user_id: z.string(),
    name: z.string(),
    points: z.number().int(),
    progress_pct: z.number().int().openapi({ description: "Capped at 100 for bars." }),
    actual_pct: z.number().int(),
    breakdown: scoreboardBreakdownSchema,
    agents: scoreboardAgentPointsSchema.array(),
    tasks_given_this_week: z.number().int(),
  })
  .openapi("ScoreboardRow");

export const scoreboardTaskTypeSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    points: z.number().int(),
    max_points: z.number().int(),
  })
  .openapi("ScoreboardTaskType");

export const scoreboardRulesSchema = z
  .object({
    task_types: scoreboardTaskTypeSchema.array(),
    review_points: z.number().int().nullable().openapi({ description: "Null when the rule is disabled." }),
    idea_accepted: z.number().int().nullable().openapi({ description: "Null when the rule is disabled." }),
    task_proposal_accepted: z.number().int().nullable().openapi({ description: "Null when the rule is disabled." }),
    active_task_limit: z.number().int(),
  })
  .openapi("ScoreboardRules");

export const scoreboardResponseSchema = z
  .object({
    range: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }),
    target: z.number().int(),
    rows: scoreboardRowSchema.array(),
    rules: scoreboardRulesSchema,
  })
  .openapi("ScoreboardResponse");

export const bidderFairnessSchema = z
  .object({
    agent_id: z.string(),
    agent_points_this_week: z.number().int(),
    owner_points_this_week: z.number().int(),
    tasks_given_this_week: z.number().int(),
    active_tasks: z.number().int(),
  })
  .openapi("BidderFairness");

export const pointsHistoryEntrySchema = z
  .object({
    id: z.string(),
    amount: z.number().int(),
    reason: z.string(),
    source_type: z.string().nullable(),
    source_id: z.string().nullable(),
    agent_id: z.string().nullable(),
    granted_by_user_id: z.string().nullable(),
    note: z.string().nullable(),
    created_at: z.iso.datetime(),
  })
  .openapi("PointsHistoryEntry");

export const pointsHistorySchema = z
  .object({
    entries: pointsHistoryEntrySchema.array(),
    balance: z.number().int(),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      total_pages: z.number().int(),
    }),
  })
  .openapi("PointsHistory");

export const scoreboardErrorSchema = z
  .object({
    error: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  })
  .openapi("ScoreboardError");

// Client-safe wire types (the API shapes above; usable from client components).
export type ScoreboardResponse = z.infer<typeof scoreboardResponseSchema>;
export type ScoreboardRow = z.infer<typeof scoreboardRowSchema>;
export type ScoreboardRules = z.infer<typeof scoreboardRulesSchema>;
export type ScoreboardBreakdown = z.infer<typeof scoreboardBreakdownSchema>;
export type ScoreboardAgentPoints = z.infer<typeof scoreboardAgentPointsSchema>;
export type PointsHistory = z.infer<typeof pointsHistorySchema>;
export type PointsHistoryEntry = z.infer<typeof pointsHistoryEntrySchema>;
