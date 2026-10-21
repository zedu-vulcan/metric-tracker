import type { Agent, Goal, Task, User, Workstream } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WorkstreamWithListRelations = Workstream & {
  goal: Pick<Goal, "id" | "title" | "type" | "status">;
  proposedByAgent?: Pick<Agent, "id" | "name" | "speciality"> | null;
  acceptedBy?: Pick<User, "id" | "name" | "email"> | null;
  _count?: {
    tasks: number;
  };
};

export type WorkstreamWithDetailRelations = Workstream & {
  goal: Pick<Goal, "id" | "title" | "description" | "type" | "status">;
  tasks: Task[];
  proposedByAgent?: Pick<Agent, "id" | "name" | "speciality"> | null;
  acceptedBy?: Pick<User, "id" | "name" | "email"> | null;
  _count?: {
    tasks: number;
  };
};

import { extractAgentKey, hashAgentKey, touchAgentActivity } from "@/lib/agents";

export function extractAgentApiKey(request: Request): string | null {
  return extractAgentKey(request);
}

export async function authenticateAgentRequest(request: Request): Promise<Agent | null> {
  const apiKey = extractAgentApiKey(request);
  if (!apiKey) return null;

  const agent = await prisma.agent.findUnique({
    where: { keyHash: hashAgentKey(apiKey) },
  });

  if (!agent) return null;

  // lastActiveAt is refreshed at most once a minute; connectedAt is set on first contact.
  const touched = await touchAgentActivity(agent);
  if (agent.connectedAt) return touched;

  return prisma.agent.update({
    where: { id: agent.id },
    data: { connectedAt: new Date() },
  });
}

export function serializeWorkstreamTask(task: Task) {
  return {
    id: task.id,
    workstreamId: task.workstreamId,
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    status: task.status,
    assignedAgentId: task.assignedAgentId,
    offeredToAgentId: task.offeredToAgentId,
    offeredAt: task.offeredAt ? task.offeredAt.toISOString() : null,
    offerExpiresAt: task.offerExpiresAt ? task.offerExpiresAt.toISOString() : null,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeWorkstreamItem(workstream: WorkstreamWithListRelations) {
  return {
    id: workstream.id,
    goalId: workstream.goalId,
    title: workstream.title,
    description: workstream.description,
    status: workstream.status,
    autoAcceptTasks: workstream.autoAcceptTasks,
    proposedByAgentId: workstream.proposedByAgentId,
    acceptedById: workstream.acceptedById,
    taskCount: workstream._count?.tasks ?? 0,
    goal: {
      id: workstream.goal.id,
      title: workstream.goal.title,
      type: workstream.goal.type,
      status: workstream.goal.status,
    },
    proposedByAgent: workstream.proposedByAgent
      ? {
          id: workstream.proposedByAgent.id,
          name: workstream.proposedByAgent.name,
          speciality: workstream.proposedByAgent.speciality,
        }
      : null,
    acceptedBy: workstream.acceptedBy
      ? {
          id: workstream.acceptedBy.id,
          name: workstream.acceptedBy.name,
          email: workstream.acceptedBy.email,
        }
      : null,
    createdAt: workstream.createdAt.toISOString(),
    updatedAt: workstream.updatedAt.toISOString(),
  };
}

export function serializeWorkstreamDetail(workstream: WorkstreamWithDetailRelations) {
  return {
    ...serializeWorkstreamItem({
      ...workstream,
      _count: workstream._count ?? { tasks: workstream.tasks.length },
    }),
    goal: {
      id: workstream.goal.id,
      title: workstream.goal.title,
      description: workstream.goal.description,
      type: workstream.goal.type,
      status: workstream.goal.status,
    },
    tasks: workstream.tasks.map(serializeWorkstreamTask),
  };
}

export function serializeAutoAcceptResponse(
  workstream: Pick<Workstream, "id" | "goalId" | "title" | "status" | "autoAcceptTasks" | "updatedAt">
) {
  return {
    id: workstream.id,
    goalId: workstream.goalId,
    title: workstream.title,
    status: workstream.status,
    autoAcceptTasks: workstream.autoAcceptTasks,
    updatedAt: workstream.updatedAt.toISOString(),
  };
}

