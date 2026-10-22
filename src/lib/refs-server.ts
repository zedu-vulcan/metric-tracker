import { prisma } from "@/lib/prisma";
import { formatRef, parseRef, type RefKind } from "@/lib/refs";

type Parent = { id: string; ref: string; title: string };

export type ResolvedRef = {
  kind: RefKind;
  ref: string;
  id: string;
  title: string;
  description: string | null;
  status: string;
  goal: Parent | null;
  idea: Parent | null;
  /** The page inside the project, e.g. `/goals/…`; null for old tasks outside any workstream. */
  path: string | null;
  /** Where an agent reads the full record. */
  apiPath: string;
};

const goalParent = (goal: { id: string; number: number; title: string }): Parent => ({
  id: goal.id,
  ref: formatRef("goal", goal.number),
  title: goal.title,
});

/** Finds the goal, idea or task a reference like `T-341` points to in this project, or null. */
export async function resolveRef(projectId: string, text: string): Promise<ResolvedRef | null> {
  const parsed = parseRef(text);
  if (!parsed) return null;
  const { kind, number, ref } = parsed;

  if (kind === "goal") {
    const goal = await prisma.goal.findUnique({ where: { projectId_number: { projectId, number } } });
    if (!goal) return null;
    return {
      kind,
      ref,
      id: goal.id,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      goal: null,
      idea: null,
      path: `/goals/${goal.id}`,
      apiPath: `/api/goals/${goal.id}`,
    };
  }

  if (kind === "idea") {
    const idea = await prisma.workstream.findFirst({
      where: { number, goal: { projectId } },
      include: { goal: { select: { id: true, number: true, title: true } } },
    });
    if (!idea) return null;
    const accepted = idea.status === "accepted";
    return {
      kind,
      ref,
      id: idea.id,
      title: idea.title,
      description: idea.description,
      status: accepted ? "accepted (a workstream)" : idea.status,
      goal: goalParent(idea.goal),
      idea: null,
      path: accepted ? `/goals/${idea.goalId}/workstreams/${idea.id}` : `/goals/${idea.goalId}`,
      apiPath: accepted ? `/api/workstreams/${idea.id}` : `/api/goals/${idea.goalId}`,
    };
  }

  const task = await prisma.task.findUnique({
    where: { projectId_number: { projectId, number } },
    include: {
      workstream: {
        select: { id: true, number: true, title: true, goal: { select: { id: true, number: true, title: true } } },
      },
    },
  });
  if (!task) return null;
  const workstream = task.workstream;
  return {
    kind,
    ref,
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status.replace(/_/g, " "),
    goal: workstream ? goalParent(workstream.goal) : null,
    idea: workstream ? { id: workstream.id, ref: formatRef("idea", workstream.number), title: workstream.title } : null,
    path: workstream ? `/goals/${workstream.goal.id}/workstreams/${workstream.id}/tasks/${task.id}` : null,
    apiPath: `/api/agent/tasks/${task.id}`,
  };
}
