import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createTaskCommentStore } from "@/lib/task-comment-store";
import {
  commentAuthors, createTaskCommentHandler, isReviewCoordinator, serializeTaskComment,
} from "@/lib/task-comments";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext(request);
  if (auth.error) return auth.error;
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        ? { type: "agent", id: auth.agent.id, ownerId: auth.agent.ownerId }
        : { type: "user", id: auth.user.id, coordinator: isReviewCoordinator(auth.user.id) },
      error: null,
    };
  },
  transaction: (work) => prisma.$transaction((tx) => work(createTaskCommentStore(tx))),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return postComment(request, params);
}
