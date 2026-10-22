import type { Prisma, Task, User } from "@prisma/client";
import { formatRef } from "@/lib/refs";
import { taskBoardExtras } from "@/lib/task-board";

export type TaskWithRelations = Task & {
  owner?: Pick<User, "id" | "name" | "email"> | null;
  user?: Pick<User, "id" | "name" | "email"> | null;
};

export function serializeTask(task: TaskWithRelations) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    // Board tasks carry no due date; null means "no due date" — never invent one.
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    done: task.done,
    completedAt: task.completedAt?.toISOString() ?? null,
    ownerId: task.ownerId,
    userId: task.userId ?? "",
    owner: task.owner
      ? {
          id: task.owner.id,
          name: task.owner.name,
          email: task.owner.email,
        }
      : null,
    user: task.user
      ? {
          id: task.user.id,
          name: task.user.name,
          email: task.user.email,
        }
      : undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeTaskOffered(task: {
  id: string;
  status: string;
  offeredToAgentId: string | null;
  offeredAt: Date | string | null;
  offerExpiresAt: Date | string | null;
  assignedAgentId: string | null;
}) {
  return {
    id: task.id,
    status: task.status,
    offeredToAgentId: task.offeredToAgentId,
    offeredAt:
      task.offeredAt instanceof Date
        ? task.offeredAt.toISOString()
        : task.offeredAt ?? null,
    offerExpiresAt:
      task.offerExpiresAt instanceof Date
        ? task.offerExpiresAt.toISOString()
        : task.offerExpiresAt ?? null,
    assignedAgentId: task.assignedAgentId,
  };
}

/** What the task board loads with each task: who posted it. */
export const boardTaskInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

type BoardTaskRecord = Prisma.TaskGetPayload<{ include: typeof boardTaskInclude }>;

/** Tasks as the task board and agents read them, with points, thread counts and the agents involved. */
export async function serializeBoardTasks(projectId: string, tasks: BoardTaskRecord[]) {
  const extras = await taskBoardExtras(projectId, tasks);
  return tasks.map((task) => ({
    id: task.id,
    ref: formatRef(task.number),
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    rationale: task.rationale,
    status: task.status,
    createdById: task.userId,
    createdBy: task.user ? { id: task.user.id, name: task.user.name, email: task.user.email } : null,
    assignedAgentId: task.assignedAgentId,
    offeredToAgentId: task.offeredToAgentId,
    offeredAt: task.offeredAt?.toISOString() ?? null,
    offerExpiresAt: task.offerExpiresAt?.toISOString() ?? null,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    ...extras.get(task.id)!,
  }));
}
