import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTaskCommentHandler, isReviewCoordinator, writeTaskComment, type CommentActor, type CommentTask,
  type SavedTaskComment, type TaskCommentStore } from "@/lib/task-comments";
import { createTaskCommentStore } from "@/lib/task-comment-store";
import type { Prisma } from "@prisma/client";
import { getOpenApiDocument } from "@/lib/openapi";

const peer: CommentActor = { type: "agent", id: "peer", ownerId: "reviewer-owner" };
const worker: CommentActor = { type: "agent", id: "worker", ownerId: "worker-owner" };
const coordinator: CommentActor = { type: "user", id: "coordinator", coordinator: true };
const baseTask: CommentTask = {
  id: "task-1", status: "submitted", workstreamId: "ws-1", assignedAgentId: "worker",
  workerOwnerId: "worker-owner", revisionCount: 0, maxRevisions: 2,
};
const revision = { type: "revision_request", body: "Please include the missing sources." };

function harness(initial: CommentTask | null = baseTask) {
  let task = initial ? { ...initial } : null;
  let comments: SavedTaskComment[] = [];
  let failInsert = false;
  let conflict = false;
  let actor: CommentActor | null = peer;
  const store: TaskCommentStore = {
    findTask: async (id) => task?.id === id ? { ...task } : null,
    changeTask: async (_observed, change) => {
      if (conflict || !task) return false;
      // The harness applies the literal updates emitted by the workflow.
      task = { ...task, ...change } as CommentTask;
      return true;
    },
    createComment: async (data) => {
      if (failInsert) throw new Error("Insert failed");
      const comment: SavedTaskComment = {
        id: `comment-${comments.length + 1}`, taskId: data.taskId, type: data.type ?? "note",
        tag: data.tag ?? null, title: data.title ?? null, body: data.body,
        attachment: data.attachment ?? null, score: data.score ?? null,
        authorAgentId: data.authorAgentId ?? null, authorUserId: data.authorUserId ?? null,
        authorAgent: null, authorUser: null,
        createdAt: new Date("2026-10-20T12:00:00Z"), updatedAt: new Date("2026-10-20T12:00:00Z"),
      };
      comments.push(comment);
      return comment;
    },
  };
  const handler = createTaskCommentHandler({
    authenticate: async () => ({ actor, error: actor ? null : new Response(null, { status: 401 }) }),
    transaction: async (work) => {
      const before = task ? { ...task } : null;
      const previousComments = [...comments];
      try { return await work(store); }
      catch (error) { task = before; comments = previousComments; throw error; }
    },
  });
  return {
    get task() { return task; }, get comments() { return comments; },
    setActor(value: CommentActor | null) { actor = value; },
    failInsert() { failInsert = true; }, conflict() { conflict = true; },
    async post(payload: unknown = revision, id = "task-1") {
      return handler(new Request(`http://localhost/api/tasks/${id}/comments`, {
        method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" },
      }), { id });
    },
    raw: (body: string) => handler(new Request("http://localhost/api/tasks/task-1/comments", {
      method: "POST", body,
    }), { id: "task-1" }),
  };
}

describe("Task 4.3 revision cycle", () => {
  it("retains the worker for two rounds and unassigns on the third request", async () => {
    const h = harness();
    for (const count of [1, 2]) {
      h.setActor(peer);
      assert.equal((await h.post()).status, 201);
      assert.equal(h.task?.revisionCount, count);
      assert.equal(h.task?.status, "changes_requested");
      assert.equal(h.task?.assignedAgentId, "worker");
      h.setActor(worker);
      assert.equal((await h.post({ type: "delivery", body: "Updated draft", attachment: "Revised work" })).status, 201);
      assert.equal(h.task?.status, "submitted");
      assert.equal(h.task?.revisionCount, count);
    }
    h.setActor(peer);
    const response = await h.post();
    assert.equal(response.status, 201);
    assert.equal(h.task?.revisionCount, 0);
    assert.equal(h.task?.status, "reopened");
    assert.equal(h.task?.assignedAgentId, null);
    assert.equal(h.comments.length, 5);
    assert.equal(h.comments.filter((comment) => comment.type === "revision_request").length, 3);
    assert.equal(h.comments[0].body, revision.body);
    assert.equal((await response.json()).createdAt, "2026-10-20T12:00:00.000Z");
    assert.equal((await h.post({ type: "bid", body: "I can take this on." })).status, 201);
    assert.equal(h.task?.status, "bidding");
  });

  it("allows a configured human coordinator and records their identity", async () => {
    const h = harness({ ...baseTask, status: "in_review" });
    h.setActor(coordinator);
    assert.equal((await h.post()).status, 201);
    assert.equal(h.comments[0].authorUserId, "coordinator");
    assert.equal(h.comments[0].authorAgentId, null);
  });

  it("does not consume another round while changes are outstanding", async () => {
    const h = harness();
    await h.post();
    assert.equal((await h.post()).status, 400);
    assert.equal(h.task?.revisionCount, 1);
    assert.equal(h.comments.length, 1);
  });

  for (const actor of [worker, { ...worker, id: "sibling-agent" },
    { type: "user", id: "ordinary-user", coordinator: false }] satisfies CommentActor[]) {
    it(`blocks unauthorized requester ${actor.id}`, async () => {
      const h = harness(); h.setActor(actor);
      assert.equal((await h.post()).status, 403);
      assert.deepEqual(h.task, baseTask);
      assert.equal(h.comments.length, 0);
    });
  }

  for (const status of ["proposed", "open", "bidding", "in_progress", "changes_requested", "approved", "reopened"] as const) {
    it(`rejects revision requests for ${status}`, async () => {
      const h = harness({ ...baseTask, status });
      assert.equal((await h.post()).status, 400);
      assert.equal(h.task?.revisionCount, 0);
      assert.equal(h.comments.length, 0);
    });
  }

  it("rejects tasks without a worker or workstream", async () => {
    for (const patch of [{ assignedAgentId: null }, { workstreamId: null }, { workerOwnerId: null }]) {
      const h = harness({ ...baseTask, ...patch });
      assert.equal((await h.post()).status, 400);
      assert.equal(h.comments.length, 0);
    }
  });

  it("returns 409 without a comment when a competing transition wins", async () => {
    const h = harness(); h.conflict();
    assert.equal((await h.post()).status, 409);
    assert.deepEqual(h.task, baseTask);
    assert.equal(h.comments.length, 0);
  });

  it("propagates insert errors through the transaction boundary", async () => {
    const h = harness(); h.failInsert();
    await assert.rejects(() => h.post(), /Insert failed/);
    assert.deepEqual(h.task, baseTask);
    assert.equal(h.comments.length, 0);
  });

  it("clears stale offer metadata when reopening", async () => {
    const h = harness({ ...baseTask, revisionCount: 2 });
    await h.post();
    const reopened = h.task as CommentTask & {
      offeredToAgentId: string | null; offeredAt: Date | null; offerExpiresAt: Date | null;
    };
    assert.equal(reopened.offeredToAgentId, null);
    assert.equal(reopened.offeredAt, null);
    assert.equal(reopened.offerExpiresAt, null);
  });

  it("caps even a higher stored limit at two revision rounds", async () => {
    const h = harness({ ...baseTask, maxRevisions: 10, revisionCount: 2 });
    await h.post();
    assert.equal(h.task?.status, "reopened");
  });

  it("allows a new worker to begin a fresh revision cycle after reassignment", async () => {
    const h = harness({ ...baseTask, assignedAgentId: "new-worker", workerOwnerId: "new-owner" });
    assert.equal((await h.post()).status, 201);
    assert.equal(h.task?.assignedAgentId, "new-worker");
    assert.equal(h.task?.revisionCount, 1);
  });
});

describe("Comments endpoint regression checks", () => {
  it("rejects missing authentication, missing task, malformed JSON, invalid payload and empty ID", async () => {
    const h = harness(); h.setActor(null);
    assert.equal((await h.post()).status, 401);
    const missing = await harness(null).post();
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Not found" });
    assert.equal((await harness().raw("{")).status, 400);
    assert.equal((await harness().post({ ...revision, body: " " })).status, 400);
    assert.equal((await harness().post(revision, " ")).status, 400);
  });

  it("preserves ordinary comments without changing the task", async () => {
    const h = harness();
    assert.equal((await h.post({ type: "note", body: "Context", attachment: "reference" })).status, 201);
    assert.deepEqual(h.task, baseTask);
    assert.equal(h.comments[0].attachment, "reference");
  });

  it("keeps the existing open-to-bidding transition", async () => {
    const h = harness({ ...baseTask, status: "open", assignedAgentId: null });
    await h.post({ type: "bid", body: "I can do it" });
    assert.equal(h.task?.status, "bidding");
  });

  it("only accepts assigned-worker deliveries with attachments in working states", async () => {
    const h = harness({ ...baseTask, status: "changes_requested", revisionCount: 1 });
    assert.equal((await h.post({ type: "delivery", body: "Work", attachment: "draft" })).status, 403);
    h.setActor(worker);
    const missingAttachment = await h.post({ type: "delivery", body: "Work" });
    assert.equal(missingAttachment.status, 400);
    assert.deepEqual(await missingAttachment.json(), {
      error: "Validation failed", details: { attachment: ["Deliverables must include an attachment"] },
    });
    assert.equal((await h.post({ type: "delivery", body: "Work", attachment: "draft" })).status, 201);
    assert.equal(h.task?.revisionCount, 1);
    assert.equal((await h.post({ type: "delivery", body: "Work", attachment: "draft" })).status, 400);
    const approved = harness({ ...baseTask, status: "approved" }); approved.setActor(worker);
    assert.equal((await approved.post({ type: "delivery", body: "Work", attachment: "draft" })).status, 400);
  });

  it("uses exact configured coordinator IDs and fails closed when unset", () => {
    assert.equal(isReviewCoordinator("owner", " owner, delegate "), true);
    assert.equal(isReviewCoordinator("delegate", "owner, delegate"), true);
    assert.equal(isReviewCoordinator("own", "owner"), false);
    assert.equal(isReviewCoordinator("owner", ""), false);
    assert.equal(isReviewCoordinator("", ","), false);
  });

  it("documents revision permissions and conflict responses", () => {
    const post = getOpenApiDocument().paths?.["/api/tasks/{id}/comments"]?.post;
    assert.ok(post?.description?.includes("REVIEW_COORDINATOR_USER_IDS"));
    assert.ok(post?.responses?.["409"]);
  });

  it("production adapter guards the observed lifecycle fields before writing", async () => {
    let update: unknown;
    const fake = {
      task: { updateMany: async (args: unknown) => { update = args; return { count: 1 }; } },
    } as unknown as Prisma.TransactionClient;
    const store = createTaskCommentStore(fake);
    assert.equal(await store.changeTask(baseTask, { status: "changes_requested", revisionCount: 1 }), true);
    assert.deepEqual(update, {
      where: { id: "task-1", status: "submitted", workstreamId: "ws-1", assignedAgentId: "worker",
        revisionCount: 0, maxRevisions: 2 },
      data: { status: "changes_requested", revisionCount: 1 },
    });
  });

  it("allows only one of two competing requests against the same delivered version", async () => {
    const template = harness(); await template.post();
    let current = { ...baseTask };
    let inserts = 0;
    const fake = {
      task: {
        findUnique: async () => ({ ...current, assignedAgent: { ownerId: current.workerOwnerId } }),
        updateMany: async ({ where, data }: {
          where: Pick<CommentTask, "status" | "revisionCount" | "assignedAgentId">;
          data: Prisma.TaskUncheckedUpdateManyInput;
        }) => {
          if (current.status !== where.status || current.revisionCount !== where.revisionCount ||
            current.assignedAgentId !== where.assignedAgentId) return { count: 0 };
          current = { ...current, ...data } as CommentTask;
          return { count: 1 };
        },
      },
      taskComment: { create: async () => { inserts += 1; return template.comments[0]; } },
    } as unknown as Prisma.TransactionClient;
    const store = createTaskCommentStore(fake);
    const input = { type: "revision_request" as const, body: revision.body };
    const results = await Promise.allSettled([
      writeTaskComment(store, peer, "task-1", input),
      writeTaskComment(store, peer, "task-1", input),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(failure?.status === "rejected");
    assert.equal(failure.reason.status, 409);
    assert.equal(current.revisionCount, 1);
    assert.equal(inserts, 1);
  });
});
