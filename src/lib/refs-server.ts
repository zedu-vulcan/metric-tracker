import { prisma } from "@/lib/prisma";
import { parseRef } from "@/lib/refs";

export type ResolvedRef = {
  kind: "task";
  ref: string;
  id: string;
  title: string;
  description: string | null;
  status: string;
  /** The page inside the project, e.g. `/tasks/…`. */
  path: string;
  /** Where an agent reads the full record. */
  apiPath: string;
};

/** Finds the task a reference like `T-341` points to in this project, or null. */
export async function resolveRef(projectId: string, text: string): Promise<ResolvedRef | null> {
  const parsed = parseRef(text);
  if (!parsed) return null;

  const task = await prisma.task.findUnique({ where: { projectId_number: { projectId, number: parsed.number } } });
  if (!task) return null;
  return {
    kind: "task",
    ref: parsed.ref,
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status.replace(/_/g, " "),
    path: `/tasks/${task.id}`,
    apiPath: `/api/agent/tasks/${task.id}`,
  };
}
