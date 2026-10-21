import { NextResponse } from "next/server";
import { taskIdParamsSchema } from "@/lib/schemas/tasks";
import { approvableTaskStatuses, taskApproveSchema } from "@/lib/schemas/task-approval";

export type TaskStatusRecord = {
  id: string;
  status: string;
  /** Human users allowed to approve this task besides coordinators (the goal creator). */
  ownerIds?: string[];
};

export type ApprovalCommentRecord = {
  id: string;
  taskId: string;
  type: "approval";
  tag: string | null;
  title: string | null;
  body: string;
  attachment: string | null;
  score: number | null;
  authorAgentId: string | null;
  authorAgent?: {
    id: string;
    name: string;
    speciality: string;
  } | null;
  authorUserId: string | null;
  authorUser?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApproveTaskInput = {
  taskId: string;
  userId: string;
  title: string | null;
  body: string;
  tag: string | null;
};

export type ApproveTaskResult = {
  completedAt: Date;
  comment: ApprovalCommentRecord;
};

export type TaskApprovalDependencies = {
  requireUser: (
    request: Request
  ) => Promise<{
    user: { id: string; name?: string | null; email?: string | null } | null;
    error: NextResponse | null;
  }>;
  findTask: (id: string) => Promise<TaskStatusRecord | null>;
  /**
   * Decides whether this human may approve this task (Review Coordinator or project owner).
   * Required: approval is a privileged action, so every consumer must state its policy.
   */
  canApprove: (
    userId: string,
    task: TaskStatusRecord
  ) => Promise<boolean> | boolean;
  approveTaskWithComment: (input: ApproveTaskInput) => Promise<ApproveTaskResult | null>;
};

export function isApprovableStatus(status: string): boolean {
  return (approvableTaskStatuses as readonly string[]).includes(status);
}

export function isTaskLockedForDelivery(status: string): boolean {
  return status === "approved";
}

export function serializeApprovalComment(comment: ApprovalCommentRecord) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    type: comment.type,
    tag: comment.tag,
    title: comment.title,
    body: comment.body,
    attachment: comment.attachment,
    score: comment.score,
    authorAgentId: comment.authorAgentId,
    authorAgent: comment.authorAgent ?? null,
    authorUserId: comment.authorUserId,
    authorUser: comment.authorUser ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function createTaskApprovalHandler(dependencies: TaskApprovalDependencies) {
  return async function POST(request: Request, params: { id: string }) {
    const { user, error } = await dependencies.requireUser(request);
    if (error) return error;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paramsResult = taskIdParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: paramsResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let rawBody: unknown = {};
    const rawText = await request.text();
    if (rawText.trim().length > 0) {
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        return NextResponse.json(
          { error: "Validation failed", details: { _errors: ["Invalid JSON"] } },
          { status: 400 }
        );
      }
    }

    const bodyResult = taskApproveSchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: bodyResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id } = paramsResult.data;
    const task = await dependencies.findTask(id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isApprovableStatus(task.status)) {
      return NextResponse.json(
        { error: "Task must be in 'submitted' or 'in_review' status to be approved" },
        { status: 400 }
      );
    }

    // Task 4.4: only a Review Coordinator or the project owner may approve.
    const allowed = await dependencies.canApprove(user.id, task);
    if (!allowed) {
      return NextResponse.json(
        { error: "Only a Review Coordinator or the project owner can approve tasks" },
        { status: 403 }
      );
    }

    const approvalResult = await dependencies.approveTaskWithComment({
      taskId: id,
      userId: user.id,
      title: bodyResult.data.title ?? null,
      body: bodyResult.data.body,
      tag: bodyResult.data.tag ?? null,
    });

    if (!approvalResult) {
      const currentTask = await dependencies.findTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Task must be in 'submitted' or 'in_review' status to be approved" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id,
      status: "approved" as const,
      done: true,
      completedAt: approvalResult.completedAt.toISOString(),
      comment: serializeApprovalComment(approvalResult.comment),
    });
  };
}

