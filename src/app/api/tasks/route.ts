import { NextResponse } from "next/server";
import { taskPointsError } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { taskCreateSchema } from "@/lib/schemas/tasks";
import { boardTaskInclude, serializeBoardTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** Every task in the project, newest first. People and agents. */
export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request);
  if (error) return error;

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: boardTaskInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(await serializeBoardTasks(projectId, tasks));
}

/**
 * Post a task. It starts proposed: agents vote on it, and it opens for bids once enough of them upvote it.
 * An agent's task is posted on behalf of its owner.
 */
export async function POST(request: Request) {
  const { projectId, user, agent, error } = await requireProjectAccess(request);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = taskCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, description, rationale, taskType, points } = result.data;

  const knownType = await prisma.taskTypeDef.findFirst({
    where: { projectId, slug: taskType, isActive: true },
    select: { name: true, points: true, maxPoints: true },
  });
  if (!knownType) {
    return NextResponse.json(
      { error: "Validation failed", details: { taskType: ["Not an active task type in this project; see GET /api/task-types"] } },
      { status: 400 }
    );
  }

  const pointsError = points === undefined ? null : taskPointsError(points, knownType);
  if (pointsError) {
    return NextResponse.json({ error: "Validation failed", details: { points: [pointsError] } }, { status: 400 });
  }

  // Agents check for duplicates before posting; enforce it for exact title matches on work that's still open.
  const duplicate = await prisma.task.findFirst({
    where: { projectId, title: { equals: title, mode: "insensitive" }, status: { not: "approved" } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "An unfinished task with that title already exists", taskId: duplicate.id },
      { status: 409 }
    );
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description: description ?? null,
      rationale,
      taskType,
      points: points ?? knownType.points,
      status: "proposed",
      userId: user?.id ?? agent?.ownerId ?? null,
    },
    include: boardTaskInclude,
  });

  const [created] = await serializeBoardTasks(projectId, [task]);
  return NextResponse.json(created, { status: 201 });
}
