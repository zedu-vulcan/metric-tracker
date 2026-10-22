import { z } from "@/lib/zod";
import {
  goalStatusSchema,
  workstreamStatusSchema,
  workstreamTaskStatusSchema,
  workstreamTaskStatusValues,
} from "@/lib/schemas/workstreams";

export const TASK_BOARD_PAGE_SIZE = 20;
export const TASK_BOARD_MAX_POINTS = 2_147_483_647;
// Keep Prisma's offset within a signed 32-bit integer.
export const TASK_BOARD_MAX_PAGE = Math.floor(2_147_483_647 / TASK_BOARD_PAGE_SIZE) + 1;
export const taskBoardStatusValues = ["open_for_bids", "all", ...workstreamTaskStatusValues] as const;
export const taskBoardQueryKeys = [
  "q", "status", "type", "goal", "agent", "minPoints", "maxPoints", "page",
] as const;

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" ? value.trim() || undefined : value;
}

function integerQuery(min: number, max: number) {
  return z.union([
    z.number().int().min(min).max(max),
    z.string().regex(/^\d+$/, "Use a whole number").transform(Number)
      .pipe(z.number().int().min(min).max(max)),
  ]);
}

const idSchema = z.string().min(1).max(200);
const pointsSchema = z.number().int().min(0).max(TASK_BOARD_MAX_POINTS);
const optionalIdQuery = z.preprocess(emptyToUndefined, idSchema.optional());

export const taskBoardQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(200).default("")),
  status: z.preprocess(emptyToUndefined, z.enum(taskBoardStatusValues).default("open_for_bids")),
  type: z.preprocess(emptyToUndefined, z.string().max(60).regex(/^[a-z0-9_]+$/).optional()),
  goal: optionalIdQuery,
  agent: optionalIdQuery,
  minPoints: z.preprocess(emptyToUndefined, integerQuery(0, TASK_BOARD_MAX_POINTS).optional()),
  maxPoints: z.preprocess(emptyToUndefined, integerQuery(0, TASK_BOARD_MAX_POINTS).optional()),
  page: z.preprocess(emptyToUndefined, integerQuery(1, TASK_BOARD_MAX_PAGE).default(1)),
}).refine(
  ({ minPoints, maxPoints }) => minPoints === undefined || maxPoints === undefined || minPoints <= maxPoints,
  { path: ["maxPoints"], message: "Maximum points must be at least minimum points" },
).openapi("TaskBoardQuery");

/** Use this at URL boundaries: object conversion alone would hide duplicate keys. */
export function parseTaskBoardQuery(params: URLSearchParams): ReturnType<typeof taskBoardQuerySchema.safeParse> {
  const duplicates = taskBoardQueryKeys.filter((key) => params.getAll(key).length > 1);
  return taskBoardQuerySchema.superRefine((_data, context) => {
    for (const key of duplicates) {
      context.addIssue({ code: "custom", path: [key], message: "Provide this filter only once" });
    }
  }).safeParse(Object.fromEntries(
    taskBoardQueryKeys.map((key) => [key, params.get(key) ?? undefined]),
  ));
}

export const taskBoardGoalSchema = z.object({
  id: idSchema, title: z.string(), status: goalStatusSchema,
});
export const taskBoardWorkstreamSchema = z.object({
  id: idSchema, title: z.string(), status: workstreamStatusSchema,
});
export const taskBoardAgentSchema = z.object({
  id: idSchema, name: z.string(), ownerName: z.string().nullable(),
});

export const taskBoardTaskSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  status: workstreamTaskStatusSchema,
  taskType: z.string().nullable(),
  taskTypeLabel: z.string(),
  points: pointsSchema.nullable(),
  goal: taskBoardGoalSchema.nullable(),
  workstream: taskBoardWorkstreamSchema.nullable(),
  assignedAgentId: idSchema.nullable(),
  assignedAgent: taskBoardAgentSchema.nullable(),
  offerPending: z.boolean(),
  offerExpiresAt: z.iso.datetime().nullable(),
  isOpenForBids: z.boolean(),
  detailsUrl: z.string().startsWith("/p/").nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).openapi("TaskBoardTask");

export const taskBoardPaginationSchema = z.object({
  page: z.number().int().min(1).max(TASK_BOARD_MAX_PAGE),
  pageSize: z.literal(TASK_BOARD_PAGE_SIZE),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const taskBoardResponseSchema = z.object({
  tasks: z.array(taskBoardTaskSchema).max(TASK_BOARD_PAGE_SIZE),
  pagination: taskBoardPaginationSchema,
}).openapi("TaskBoardResponse");

export const taskBoardOptionsSchema = z.object({
  types: z.array(z.object({ value: z.string(), label: z.string(), isActive: z.boolean().nullable() })),
  goals: z.array(taskBoardGoalSchema),
  agents: z.array(taskBoardAgentSchema.extend({ isMine: z.boolean() })),
}).openapi("TaskBoardOptions");

export type TaskBoardQuery = z.infer<typeof taskBoardQuerySchema>;
export type TaskBoardStatus = TaskBoardQuery["status"];
export type TaskBoardTask = z.infer<typeof taskBoardTaskSchema>;
export type TaskBoardPagination = z.infer<typeof taskBoardPaginationSchema>;
export type TaskBoardResponse = z.infer<typeof taskBoardResponseSchema>;
export type TaskBoardOptions = z.infer<typeof taskBoardOptionsSchema>;
