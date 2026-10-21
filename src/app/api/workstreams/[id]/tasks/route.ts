import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { goalTaskCreateSchema } from "@/lib/schemas/tasks";
import { workstreamIdParamsSchema } from "@/lib/schemas/workstreams";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  // 1. Authenticate caller (supports both human users and agents)
  const { projectId, error } = await requireProjectAccess(req);
  if (error) return error;

  // 2. Validate the path param before it reaches Prisma
  const paramsResult = workstreamIdParamsSchema.safeParse(params);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: paramsResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const workstreamId = paramsResult.data.id;

  // 3. Parse and validate request body using Zod schema
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 },
    );
  }

  const result = goalTaskCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // 4. Verify parent workstream exists and is accepted.
  // Rule: Tasks cannot be proposed under an unaccepted idea/workstream.
  const workstream = await prisma.workstream.findFirst({
    where: { id: workstreamId, goal: { projectId } },
    select: { id: true, status: true },
  });

  if (!workstream) {
    return NextResponse.json(
      { error: "Workstream not found" },
      { status: 404 },
    );
  }

  if (workstream.status !== "accepted") {
    return NextResponse.json(
      { error: "Cannot propose tasks under an unaccepted idea" },
      { status: 400 },
    );
  }

  const { title, description, taskType } = result.data;

  const knownType = await prisma.taskTypeDef.findFirst({
    where: { projectId, slug: taskType, isActive: true },
    select: { id: true },
  });
  if (!knownType) {
    return NextResponse.json(
      { error: "Validation failed", details: { taskType: ["Not an active task type in this project; see GET /api/task-types"] } },
      { status: 400 },
    );
  }

  // 5. Agents check for duplicates before proposing; enforce it for exact title matches.
  const duplicate = await prisma.task.findFirst({
    where: { workstreamId, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "This workstream already has a task with that title", taskId: duplicate.id },
      { status: 409 },
    );
  }

  // 6. Tasks open for bidding as soon as they're created; there is no human approval step.
  const newTask = await prisma.task.create({
    data: {
      projectId,
      workstreamId,
      title,
      description: description ?? null,
      taskType,
      status: "open",
    },
  });

  return NextResponse.json(newTask, { status: 201 });
}
