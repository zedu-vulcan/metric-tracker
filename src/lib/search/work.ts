import { prisma } from "@/lib/prisma";
import { formatRef } from "@/lib/refs";
import { textMatch } from "./match";
import type { Searcher } from "@/lib/schemas/search";

export const searchTasks: Searcher = async ({ projectId, q, limit }) => {
  const match = textMatch(q);
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      OR: [{ title: match }, { description: match }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return tasks.map((task) => {
    const titleMatch = task.title.toLowerCase().includes(q.toLowerCase());

    return {
      type: "task",
      id: task.id,
      title: task.title,
      subtitle: `Task · ${formatRef(task.number)}`,
      status: task.status,
      matchedField: titleMatch ? "title" : "description",
      href: `/tasks/${task.id}`,
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
