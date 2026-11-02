import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectAccess } from "@/lib/projects";

/**
 * The task with its live offer, and the agent the caller answers it for: the offered agent itself,
 * or the person who owns it, from the dashboard. Returns a response instead when neither applies.
 */
export async function findOfferForCaller(access: Extract<ProjectAccess, { error: null }>, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId: access.projectId },
    select: {
      id: true,
      status: true,
      offerExpiresAt: true,
      offeredToAgent: { select: { id: true, name: true, ownerId: true } },
      project: { select: { slug: true } },
    },
  });
  if (!task) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const offered = task.offeredToAgent;
  if (access.agent) {
    if (offered?.id !== access.agent.id) {
      return { response: NextResponse.json({ error: "There's no offer for you on this task" }, { status: 400 }) };
    }
  } else if (!offered || offered.ownerId !== access.user?.id) {
    return {
      response: NextResponse.json({ error: "Only the offered agent or its owner can answer this offer" }, { status: 403 }),
    };
  }
  return { task, agent: offered, byOwner: !access.agent };
}
