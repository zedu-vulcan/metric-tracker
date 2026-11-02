import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { callerInProject } from "@/lib/projects";
import { createTaskCommentStore } from "@/lib/task-comment-store";
import { commentAuthors, createTaskCommentHandler, serializeTaskComment } from "@/lib/task-comments";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext(request);
  if (auth.error) return auth.error;
  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { projectId: true } });
  const caller = auth.type === "agent" ? { agent: auth.agent } : { userId: auth.user.id };
  if (!task || !(await callerInProject(task.projectId, caller))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.id }, include: commentAuthors, orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(comments.map(serializeTaskComment));
}

const postComment = createTaskCommentHandler({
  async authenticate(request) {
    const auth = await getAuthContext(request);
    if (auth.type === null) return { actor: null, error: auth.error };
    return {
      actor: auth.type === "agent"
        ? { type: "agent", id: auth.agent.id, ownerId: auth.agent.ownerId, projectId: auth.agent.projectId }
        : { type: "user", id: auth.user.id },
      error: null,
    };
  },
  transaction: (work) => prisma.$transaction((tx) => work(createTaskCommentStore(tx))),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const response = await postComment(request, params);
  if (response.ok) {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { project: { select: { slug: true } } },
    });
    if (task?.project?.slug) {
      revalidatePath(`/p/${task.project.slug}/work`);
    }
  }
  return response;
}
