import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import { getOpenApiDocument } from "@/lib/openapi";
import {
  taskApprovalResponseSchema,
  taskApproveSchema,
} from "@/lib/schemas/task-approval";
import {
  type ApprovalCommentRecord,
  createTaskApprovalHandler,
  isApprovableStatus,
  isTaskLockedForDelivery,
} from "@/lib/task-approval";

type TestTask = {
  id: string;
  status: string;
  done: boolean;
  completedAt: Date | null;
};

function createHarness(
  initialTask: TestTask | null,
  options?: {
    authStatus?: 401 | 403;
    userId?: string;
    userName?: string;
    userEmail?: string;
  }
) {
  let task = initialTask ? { ...initialTask } : null;
  const comments: ApprovalCommentRecord[] = [];
  let approvalCalls = 0;

  const userId = options?.userId ?? "coordinator-1";
  const userName = options?.userName ?? "Review Coordinator";
  const userEmail = options?.userEmail ?? "coordinator@zedu.chat";

  const handler = createTaskApprovalHandler({
    requireUser: async () => {
      if (options?.authStatus === 401) {
        return {
          user: null,
          error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
      }
      if (options?.authStatus === 403) {
        return {
          user: null,
          error: NextResponse.json(
            { error: "Agents are not permitted to perform this action. Human user required." },
            { status: 403 }
          ),
        };
      }
      return {
        user: { id: userId, name: userName, email: userEmail },
        error: null,
      };
    },
    findTask: async (id) => (task?.id === id ? { id: task.id, status: task.status } : null),
    approveTaskWithComment: async ({ taskId, userId: authorId, title, body, tag }) => {
      approvalCalls += 1;
      if (!task || task.id !== taskId || !isApprovableStatus(task.status)) {
        return null;
      }

      const now = new Date("2026-10-20T22:00:00.000Z");
      task = {
        ...task,
        status: "approved",
        done: true,
        completedAt: now,
      };

      const comment: ApprovalCommentRecord = {
        id: `comment-${comments.length + 1}`,
        taskId,
        type: "approval",
        tag,
        title,
        body,
        attachment: null,
        score: null,
        authorAgentId: null,
        authorAgent: null,
        authorUserId: authorId,
        authorUser: {
          id: authorId,
          name: userName,
          email: userEmail,
        },
        createdAt: now,
        updatedAt: now,
      };

      comments.push(comment);
      return { completedAt: now, comment };
    },
  });

  return {
    handler,
    get task() {
      return task;
    },
    get comments() {
      return comments;
    },
    get approvalCalls() {
      return approvalCalls;
    },
  };
}

async function postApprove(
  handler: ReturnType<typeof createTaskApprovalHandler>,
  options?: {
    id?: string;
    body?: string | Record<string, unknown>;
  }
) {
  const id = options?.id ?? "task-1";
  const rawBody =
    typeof options?.body === "string"
      ? options.body
      : options?.body !== undefined
        ? JSON.stringify(options.body)
        : undefined;

  return handler(
    new Request(`http://localhost/api/tasks/${id}/approve`, {
      method: "POST",
      headers: rawBody ? { "Content-Type": "application/json" } : undefined,
      body: rawBody,
    }),
    { id }
  );
}

describe("Task 4.4 — POST /api/tasks/{id}/approve", () => {
  it("approves a submitted task with default approval comment when body is omitted", async () => {
    const harness = createHarness({
      id: "task-1",
      status: "submitted",
      done: false,
      completedAt: null,
    });

    const response = await postApprove(harness.handler);
    assert.equal(response.status, 200);

    const payload = await response.json();
    const parsedResponse = taskApprovalResponseSchema.safeParse(payload);
    assert.equal(parsedResponse.success, true);

    assert.equal(payload.id, "task-1");
    assert.equal(payload.status, "approved");
    assert.equal(payload.done, true);
    assert.equal(payload.completedAt, "2026-10-20T22:00:00.000Z");
    assert.equal(payload.comment.type, "approval");
    assert.equal(payload.comment.body, "Task deliverable approved.");
    assert.equal(payload.comment.authorUserId, "coordinator-1");
    assert.equal(harness.task?.status, "approved");
    assert.equal(harness.comments.length, 1);
    assert.equal(harness.approvalCalls, 1);
  });

  it("approves an in_review task with custom title, body, and tag", async () => {
    const harness = createHarness({
      id: "task-2",
      status: "in_review",
      done: false,
      completedAt: null,
    });

    const response = await postApprove(harness.handler, {
      id: "task-2",
      body: {
        title: "Final Sign-Off",
        body: "Excellent SEO improvements and clean structure.",
        tag: "seo",
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.id, "task-2");
    assert.equal(payload.status, "approved");
    assert.equal(payload.comment.type, "approval");
    assert.equal(payload.comment.title, "Final Sign-Off");
    assert.equal(payload.comment.body, "Excellent SEO improvements and clean structure.");
    assert.equal(payload.comment.tag, "seo");
    assert.equal(harness.task?.status, "approved");
  });

  it("rejects approval for non-approvable statuses (proposed, open, bidding, in_progress, changes_requested, reopened, approved)", async () => {
    const invalidStatuses = [
      "proposed",
      "open",
      "bidding",
      "in_progress",
      "changes_requested",
      "reopened",
      "approved",
    ];

    for (const status of invalidStatuses) {
      const harness = createHarness({
        id: "task-1",
        status,
        done: false,
        completedAt: null,
      });

      const response = await postApprove(harness.handler);
      assert.equal(response.status, 400, `Expected 400 for status=${status}`);
      assert.deepEqual(await response.json(), {
        error: "Task must be in 'submitted' or 'in_review' status to be approved",
      });
      assert.equal(harness.approvalCalls, 0);
      assert.equal(harness.comments.length, 0);
      assert.equal(harness.task?.status, status);
    }
  });

  it("transitions task to approved and locks further approvals and deliverable submissions", async () => {
    const harness = createHarness({
      id: "task-1",
      status: "submitted",
      done: false,
      completedAt: null,
    });

    assert.equal(isTaskLockedForDelivery(harness.task!.status), false);

    const firstResponse = await postApprove(harness.handler);
    assert.equal(firstResponse.status, 200);
    assert.equal(harness.task?.status, "approved");
    assert.equal(isTaskLockedForDelivery(harness.task!.status), true);

    // Attempting to approve again after already approved is rejected
    const secondResponse = await postApprove(harness.handler);
    assert.equal(secondResponse.status, 400);
    assert.equal(harness.comments.length, 1);
  });

  it("handles concurrent state change between initial lookup and transaction", async () => {
    let lookupCount = 0;
    const handler = createTaskApprovalHandler({
      requireUser: async () => ({
        user: { id: "user-1", name: "Coordinator", email: "c@zedu.chat" },
        error: null,
      }),
      findTask: async (id) => ({
        id,
        status: lookupCount++ === 0 ? "submitted" : "changes_requested",
      }),
      approveTaskWithComment: async () => null,
    });

    const response = await postApprove(handler);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Task must be in 'submitted' or 'in_review' status to be approved",
    });
  });

  it("returns 404 when the task does not exist", async () => {
    const harness = createHarness(null);
    const response = await postApprove(harness.handler, { id: "missing-task" });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
    assert.equal(harness.approvalCalls, 0);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const harness = createHarness(
      { id: "task-1", status: "submitted", done: false, completedAt: null },
      { authStatus: 401 }
    );
    const response = await postApprove(harness.handler);

    assert.equal(response.status, 401);
    assert.equal(harness.approvalCalls, 0);
    assert.equal(harness.task?.status, "submitted");
  });

  it("rejects agent callers with 403 Forbidden", async () => {
    const harness = createHarness(
      { id: "task-1", status: "submitted", done: false, completedAt: null },
      { authStatus: 403 }
    );
    const response = await postApprove(harness.handler);

    assert.equal(response.status, 403);
    assert.equal(harness.approvalCalls, 0);
    assert.equal(harness.task?.status, "submitted");
  });

  it("rejects malformed JSON and invalid body fields with 400", async () => {
    const harness = createHarness({
      id: "task-1",
      status: "submitted",
      done: false,
      completedAt: null,
    });

    const badJsonResponse = await postApprove(harness.handler, {
      body: "{not-valid-json",
    });
    assert.equal(badJsonResponse.status, 400);

    const emptyBodyFieldResponse = await postApprove(harness.handler, {
      body: { body: "   " },
    });
    assert.equal(emptyBodyFieldResponse.status, 400);

    const oversizedTitleResponse = await postApprove(harness.handler, {
      body: { title: "x".repeat(201) },
    });
    assert.equal(oversizedTitleResponse.status, 400);

    assert.equal(harness.approvalCalls, 0);
  });

  it("validates taskApproveSchema boundaries directly", () => {
    assert.equal(taskApproveSchema.safeParse({}).success, true);
    assert.equal(
      taskApproveSchema.safeParse({
        title: "Approved",
        body: "Looks good",
        tag: "content",
      }).success,
      true
    );
    assert.equal(taskApproveSchema.safeParse({ body: "" }).success, false);
    assert.equal(
      taskApproveSchema.safeParse({ body: "x".repeat(10001) }).success,
      false
    );
  });

  it("registers POST /api/tasks/{id}/approve in the OpenAPI document", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    const approvePath = doc.paths["/api/tasks/{id}/approve"];
    assert.ok(approvePath, "/api/tasks/{id}/approve is registered");
    assert.ok(approvePath.post, "POST /api/tasks/{id}/approve is registered");
    assert.equal(approvePath.post.tags?.[0], "Tasks");
  });
});

