import type { Prisma } from "@prisma/client";
import { TASK_BOARD_PAGE_SIZE } from "@/lib/schemas/task-board";
import type { TaskBoardOptions, TaskBoardQuery, TaskBoardResponse, TaskBoardTask } from "@/lib/schemas/task-board";

const taskSelect = {
  id: true, projectId: true, title: true, description: true, status: true,
  taskType: true, points: true, assignedAgentId: true, offeredToAgentId: true,
  offerExpiresAt: true, createdAt: true, updatedAt: true,
  workstream: {
    select: {
      id: true, title: true, status: true,
      goal: { select: { id: true, projectId: true, title: true, status: true } },
    },
  },
  assignedAgent: {
    select: { id: true, projectId: true, name: true, owner: { select: { name: true } } },
  },
} satisfies Prisma.TaskSelect;

export type TaskBoardRecord = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;
export type TaskBoardTypeRecord = { slug: string; name: string; points: number; isActive: boolean };
type BoardAgentOption = { id: string; name: string; ownerId: string; owner: { name: string | null } };
type BoardContext = { projectId: string; userId: string };
type BoardResult<T> = { status: "ok"; data: T } | { status: "not_found" };

/** Narrow read-only boundary, following the existing injectable-store pattern. */
export interface TaskBoardStore {
  project(projectId: string): Promise<{ slug: string } | null>;
  goalExists(projectId: string, id: string): Promise<boolean>;
  agentExists(projectId: string, id: string): Promise<boolean>;
  types(projectId: string): Promise<TaskBoardTypeRecord[]>;
  goals(projectId: string): Promise<TaskBoardOptions["goals"]>;
  agents(projectId: string): Promise<BoardAgentOption[]>;
  usedTypes(projectId: string): Promise<{ taskType: string | null }[]>;
  tasks(where: Prisma.TaskWhereInput, skip: number): Promise<TaskBoardRecord[]>;
  count(where: Prisma.TaskWhereInput): Promise<number>;
}

/** The caller supplies the shared Prisma client/transaction; this module creates no connection. */
export function prismaTaskBoardStore(client: Prisma.TransactionClient): TaskBoardStore {
  return {
    project: (projectId) => client.project.findFirst({ where: { id: projectId }, select: { slug: true } }),
    async goalExists(projectId, id) {
      return Boolean(await client.goal.findFirst({ where: { id, projectId }, select: { id: true } }));
    },
    async agentExists(projectId, id) {
      return Boolean(await client.agent.findFirst({ where: { id, projectId }, select: { id: true } }));
    },
    types: (projectId) => client.taskTypeDef.findMany({
      where: { projectId }, select: { slug: true, name: true, points: true, isActive: true },
    }),
    goals: (projectId) => client.goal.findMany({
      where: { projectId }, select: { id: true, title: true, status: true },
    }),
    agents: (projectId) => client.agent.findMany({
      where: { projectId }, select: { id: true, name: true, ownerId: true, owner: { select: { name: true } } },
    }),
    usedTypes: (projectId) => client.task.findMany({
      where: { projectId, taskType: { not: null } }, select: { taskType: true }, distinct: ["taskType"],
    }),
    tasks: (where, skip) => client.task.findMany({
      where, select: taskSelect, skip, take: TASK_BOARD_PAGE_SIZE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    count: (where) => client.task.count({ where }),
  };
}

export function taskBoardOfferPending(task: Pick<TaskBoardRecord, "offeredToAgentId" | "offerExpiresAt">, now: Date) {
  return task.offeredToAgentId !== null && (task.offerExpiresAt === null || task.offerExpiresAt > now);
}

export function taskBoardIsOpen(task: TaskBoardRecord, projectId: string, now: Date) {
  return task.projectId === projectId && ["open", "bidding", "reopened"].includes(task.status)
    && task.assignedAgentId === null && task.workstream?.status === "accepted"
    && task.workstream.goal.projectId === projectId && task.workstream.goal.status === "active"
    && !taskBoardOfferPending(task, now);
}

export function buildTaskBoardWhere(
  { projectId, userId }: BoardContext,
  query: TaskBoardQuery,
  types: TaskBoardTypeRecord[],
  now: Date,
): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [];
  if (query.status === "open_for_bids") {
    and.push({
      status: { in: ["open", "bidding", "reopened"] }, assignedAgentId: null,
      workstream: { is: { status: "accepted", goal: { is: { projectId, status: "active" } } } },
      OR: [{ offeredToAgentId: null }, { offerExpiresAt: { lte: now } }],
    });
  } else if (query.status !== "all") {
    and.push({ status: query.status });
  }
  if (query.q) {
    // Prisma/PostgreSQL contains uses ILIKE; escape wildcard and escape characters.
    const literal = query.q.replace(/[\\%_]/g, "\\$&");
    and.push({ OR: [
      { title: { contains: literal, mode: "insensitive" } },
      { description: { contains: literal, mode: "insensitive" } },
    ] });
  }
  if (query.type) and.push({ taskType: query.type });
  if (query.goal) and.push({ workstream: { is: { goalId: query.goal, goal: { is: { projectId } } } } });
  if (query.agent === "unassigned") and.push({ assignedAgentId: null });
  else if (query.agent === "mine") and.push({ assignedAgent: { is: { projectId, ownerId: userId } } });
  else if (query.agent) and.push({ assignedAgentId: query.agent, assignedAgent: { is: { projectId } } });
  if (query.minPoints !== undefined || query.maxPoints !== undefined) {
    const fallbackTypes = types.filter((type) => type.isActive
      && (query.minPoints === undefined || type.points >= query.minPoints)
      && (query.maxPoints === undefined || type.points <= query.maxPoints)).map((type) => type.slug);
    and.push({ OR: [
      { points: { not: null, ...(query.minPoints !== undefined ? { gte: query.minPoints } : {}), ...(query.maxPoints !== undefined ? { lte: query.maxPoints } : {}) } },
      { points: null, taskType: { in: fallbackTypes } },
    ] });
  }
  return { projectId, ...(and.length ? { AND: and } : {}) };
}

export function serializeTaskBoardTask(
  task: TaskBoardRecord,
  project: { id: string; slug: string },
  types: ReadonlyMap<string, TaskBoardTypeRecord>,
  now: Date,
): TaskBoardTask {
  const type = task.taskType === null ? undefined : types.get(task.taskType);
  // Corrupt cross-project joins must not expose another project's records or route IDs.
  const workstream = task.workstream?.goal.projectId === project.id ? task.workstream : null;
  const agent = task.assignedAgent?.projectId === project.id ? task.assignedAgent : null;
  const segment = encodeURIComponent;
  return {
    id: task.id, projectId: task.projectId, title: task.title, description: task.description,
    status: task.status, taskType: task.taskType,
    taskTypeLabel: type?.name ?? task.taskType ?? "Not set",
    points: task.points ?? (type?.isActive ? type.points : null),
    goal: workstream ? { id: workstream.goal.id, title: workstream.goal.title, status: workstream.goal.status } : null,
    workstream: workstream ? { id: workstream.id, title: workstream.title, status: workstream.status } : null,
    assignedAgentId: agent?.id ?? null,
    assignedAgent: agent ? { id: agent.id, name: agent.name, ownerName: agent.owner.name } : null,
    offerPending: taskBoardOfferPending(task, now), offerExpiresAt: task.offerExpiresAt?.toISOString() ?? null,
    isOpenForBids: taskBoardIsOpen(task, project.id, now),
    detailsUrl: workstream ? `/p/${segment(project.slug)}/goals/${segment(workstream.goal.id)}/workstreams/${segment(workstream.id)}/tasks/${segment(task.id)}` : null,
    createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
  };
}

export async function listTaskBoard(
  store: TaskBoardStore, context: BoardContext, query: TaskBoardQuery, now = new Date(),
): Promise<BoardResult<TaskBoardResponse>> {
  const { projectId } = context;
  const project = await store.project(projectId);
  if (!project) return { status: "not_found" };
  if (query.goal && !await store.goalExists(projectId, query.goal)) return { status: "not_found" };
  if (query.agent && !["mine", "unassigned"].includes(query.agent) && !await store.agentExists(projectId, query.agent)) return { status: "not_found" };
  const types = await store.types(projectId);
  const where = buildTaskBoardWhere(context, query, types, now);
  const total = await store.count(where);
  const skip = (query.page - 1) * TASK_BOARD_PAGE_SIZE;
  const tasks = skip < total ? await store.tasks(where, skip) : [];
  const typeMap = new Map(types.map((type) => [type.slug, type]));
  return { status: "ok", data: {
    tasks: tasks.map((task) => serializeTaskBoardTask(task, { id: projectId, slug: project.slug }, typeMap, now)),
    pagination: { page: query.page, pageSize: TASK_BOARD_PAGE_SIZE, total, totalPages: Math.ceil(total / TASK_BOARD_PAGE_SIZE) },
  } };
}

function compareLabel(a: string, b: string) {
  return a.localeCompare(b, "en");
}

export async function listTaskBoardOptions(store: TaskBoardStore, { projectId, userId }: BoardContext): Promise<BoardResult<TaskBoardOptions>> {
  if (!await store.project(projectId)) return { status: "not_found" };
  const [types, usedTypes, goals, agents] = await Promise.all([
    store.types(projectId), store.usedTypes(projectId), store.goals(projectId), store.agents(projectId),
  ]);
  const options = new Map<string, TaskBoardOptions["types"][number]>(types.map((type) => [
    type.slug, { value: type.slug, label: type.name, isActive: type.isActive },
  ]));
  for (const { taskType } of usedTypes) {
    if (taskType !== null && !options.has(taskType)) options.set(taskType, { value: taskType, label: taskType, isActive: null });
  }
  return { status: "ok", data: {
    types: [...options.values()].sort((a, b) => compareLabel(a.label, b.label) || compareLabel(a.value, b.value)),
    goals: goals.sort((a, b) => compareLabel(a.title, b.title) || compareLabel(a.id, b.id)),
    agents: agents.map((agent) => ({ id: agent.id, name: agent.name, ownerName: agent.owner.name, isMine: agent.ownerId === userId }))
      .sort((a, b) => compareLabel(a.name, b.name) || compareLabel(a.id, b.id)),
  } };
}
