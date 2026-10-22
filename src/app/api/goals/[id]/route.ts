import { NextResponse } from "next/server";
import { getAuthContext, requireUser } from "@/lib/api";
import { serializeUpvote, upvoteInclude } from "@/lib/idea-upvotes";
import { canDeleteGoal } from "@/lib/goal-delete";
import { callerInProject, getMembership } from "@/lib/projects";
import { prisma } from "@/lib/prisma";
import { goalUpdateSchema } from "@/lib/schemas/goals";

export const dynamic = "force-dynamic";

/** One goal with its accepted workstreams and pending ideas. Readable with a session or an agent key. */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContext(request);
  if (auth.error) return auth.error;

  const { id } = params;

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      workstreams: {
        include: {
          proposedByAgent: {
            select: { id: true, name: true, speciality: true, lastActiveAt: true, ownerId: true, owner: { select: { id: true, name: true } } },
          },
          acceptedBy: { select: { id: true, name: true, email: true } },
          upvotes: { include: upvoteInclude, orderBy: { createdAt: "asc" } },
          downvotes: { include: upvoteInclude, orderBy: { createdAt: "asc" } },
          tasks: {
            select: {
              id: true,
              title: true,
              taskType: true,
              status: true,
              assignedAgentId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const caller = auth.type === "agent" ? { agent: auth.agent } : { userId: auth.user.id };
  if (!goal || !(await callerInProject(goal.projectId, caller))) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const workstreams = goal.workstreams.map((ws) => ({ ...ws, upvotes: ws.upvotes.map(serializeUpvote), downvotes: ws.downvotes.map(serializeUpvote) }));
  const acceptedWorkstreams = workstreams.filter((ws) => ws.status === "accepted");
  const pendingIdeas = workstreams.filter((ws) => ws.status === "proposed");
  const rejectedIdeas = workstreams.filter((ws) => ws.status === "rejected");

  return NextResponse.json({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    type: goal.type,
    status: goal.status,
    createdById: goal.createdById,
    createdBy: goal.createdBy,
    acceptedWorkstreams,
    pendingIdeas,
    rejectedIdeas,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Only humans modify top-level goals; requireUser blocks agent keys with 403.
  const { user, error } = await requireUser(request);
  if (error) return error;

  const { id } = params;

  const existing = await prisma.goal.findUnique({
    where: { id },
  });

  if (!existing || !user || !(await callerInProject(existing.projectId, { userId: user.id }))) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
      { status: 400 }
    );
  }

  const result = goalUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, description, status } = result.data;

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      workstreams: {
        select: {
          id: true,
          status: true,
          _count: {
            select: { tasks: true },
          },
        },
      },
    },
  });

  const workstreamCount = updated.workstreams.length;
  const taskCount = updated.workstreams.reduce((acc, ws) => acc + ws._count.tasks, 0);

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    type: updated.type,
    status: updated.status,
    createdById: updated.createdById,
    createdBy: updated.createdBy,
    workstreamCount,
    taskCount,
    _count: {
      workstreams: workstreamCount,
      tasks: taskCount,
    },
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/**
 * Deletes a goal with its ideas, workstreams, tasks and threads. Its creator can do this for 30 minutes
 * after creating it; project owners and admins can at any time. Points already paid stay in the ledger.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const goal = await prisma.goal.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, createdById: true, createdAt: true },
  });
  const membership = goal && user ? await getMembership(user.id, goal.projectId) : null;
  if (!goal || !user || !membership) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const check = canDeleteGoal({ role: membership.role, isCreator: goal.createdById === user.id, createdAt: goal.createdAt });
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  await prisma.goal.delete({ where: { id: goal.id } });
  return new NextResponse(null, { status: 204 });
}
