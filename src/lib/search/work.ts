import { prisma } from "@/lib/prisma";
import { textMatch } from "./match";
import type { Searcher } from "@/lib/schemas/search";

export const searchGoals: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const goals = await prisma.goal.findMany({
    where: {
      projectId,
      OR: [{ title: match }, { description: match }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return goals.map((goal) => {
    const titleMatch = goal.title.toLowerCase().includes(q.toLowerCase());
    return {
      type: "goal",
      id: goal.id,
      title: goal.title,
      subtitle: `Goal · ${goal.type}`,
      status: goal.status,
      matchedField: titleMatch ? "title" : "description",
      href: `/goals/${goal.id}`,
    };
  });
};

export const searchWorkstreams: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const workstreams = await prisma.workstream.findMany({
    where: {
      goal: { projectId },
      OR: [{ title: match }, { description: match }],
    },
    include: {
      goal: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return workstreams.map((ws) => {
    const titleMatch = ws.title.toLowerCase().includes(q.toLowerCase());
    const isProposed = ws.status === "proposed";
    const subtitle = isProposed
      ? `Idea in ${ws.goal.title}`
      : `Workstream in ${ws.goal.title}`;

    return {
      type: "workstream",
      id: ws.id,
      title: ws.title,
      subtitle,
      status: ws.status,
      matchedField: titleMatch ? "title" : "description",
      href: `/goals/${ws.goalId}/workstreams/${ws.id}`,
    };
  });
};

export const searchTasks: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      OR: [{ title: match }, { description: match }],
    },
    include: {
      workstream: {
        select: {
          goalId: true,
          title: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return tasks.map((task) => {
    const titleMatch = task.title.toLowerCase().includes(q.toLowerCase());
    const hasWorkstream = task.workstreamId && task.workstream;

    return {
      type: "task",
      id: task.id,
      title: task.title,
      subtitle: hasWorkstream
        ? `Task in ${task.workstream!.title}`
        : "Task · No workstream",
      status: task.status,
      matchedField: titleMatch ? "title" : "description",
      href: hasWorkstream
        ? `/goals/${task.workstream!.goalId}/workstreams/${task.workstreamId}/tasks/${task.id}`
        : `/goals`,
    };
  });
};

export const searchAgents: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const agents = await prisma.agent.findMany({
    where: {
      projectId,
      OR: [{ name: match }, { speciality: match }, { description: match }],
    },
    select: {
      id: true,
      name: true,
      speciality: true,
      description: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return agents.map((agent) => {
    const titleMatch = agent.name.toLowerCase().includes(q.toLowerCase());
    const matchedField = titleMatch
      ? "name"
      : agent.speciality.toLowerCase().includes(q.toLowerCase())
        ? "speciality"
        : "description";

    return {
      type: "agent",
      id: agent.id,
      title: agent.name,
      subtitle: agent.speciality,
      status: null,
      matchedField,
      href: `/profile?tab=agents`,
    };
  });
};
