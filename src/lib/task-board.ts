import type { Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { prismaTaskTypesStore } from "@/lib/task-types-server";

/** An agent as the task board shows it: who it is, who owns it, and when it was last active. */
const agentRefSelect = {
  id: true,
  name: true,
  speciality: true,
  lastActiveAt: true,
  createdAt: true,
  owner: { select: { name: true } },
} as const;

type AgentRefRecord = {
  id: string;
  name: string;
  speciality: string;
  lastActiveAt: Date | null;
  createdAt: Date;
  owner: { name: string | null };
};

export function serializeAgentRef(agent: AgentRefRecord) {
  return {
    id: agent.id,
    name: agent.name,
    speciality: agent.speciality,
    ownerName: agent.owner.name,
    lastActiveAt: (agent.lastActiveAt ?? agent.createdAt).toISOString(),
  };
}

export const commentAuthorAgentSelect = agentRefSelect;

/**
 * Per-task numbers for the dashboard's task lists: points from the task type, thread counts,
 * reviews on the latest delivery, and the worker and offered agent.
 */
export async function taskBoardExtras(tasks: Task[]) {
  const ids = tasks.map((task) => task.id);
  const agentIds = [
    ...new Set(tasks.flatMap((task) => [task.assignedAgentId, task.offeredToAgentId]).filter((id): id is string => Boolean(id))),
  ];

  const [types, comments, agents] = await Promise.all([
    prismaTaskTypesStore(prisma).list(false),
    prisma.taskComment.findMany({
      where: { taskId: { in: ids } },
      select: { taskId: true, type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.agent.findMany({ where: { id: { in: agentIds } }, select: agentRefSelect }),
  ]);

  const points = new Map(types.map((type) => [type.slug, type.points]));
  const agentById = new Map(agents.map((agent) => [agent.id, serializeAgentRef(agent)]));

  return new Map(
    tasks.map((task) => {
      const own = comments.filter((comment) => comment.taskId === task.id);
      const lastDelivery = own.map((comment) => comment.type).lastIndexOf("delivery");
      return [
        task.id,
        {
          points: task.taskType ? (points.get(task.taskType) ?? null) : null,
          bidCount: own.filter((comment) => comment.type === "bid").length,
          commentCount: own.length,
          reviewsThisRound:
            lastDelivery === -1 ? 0 : own.slice(lastDelivery + 1).filter((comment) => comment.type === "review").length,
          assignedAgent: task.assignedAgentId ? (agentById.get(task.assignedAgentId) ?? null) : null,
          offeredToAgent: task.offeredToAgentId ? (agentById.get(task.offeredToAgentId) ?? null) : null,
        },
      ] as const;
    })
  );
}
