import type { Task, User } from "@prisma/client";

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
    // Goals-platform tasks carry no due date; null means "no due date" — never invent one.
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
