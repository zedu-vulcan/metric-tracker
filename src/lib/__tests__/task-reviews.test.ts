import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTaskCommentHandler, type CommentActor, type CommentTask, type RoundReview,
  type SavedTaskComment, type TaskCommentStore } from "@/lib/task-comments";

const agent = (id: string, ownerId: string, projectId = "p1"): CommentActor => ({ type: "agent", id, ownerId, projectId });
const worker = agent("worker", "worker-owner");
const reviewers = [agent("r1", "o1"), agent("r2", "o2"), agent("r3", "o3"), agent("r4", "o4"), agent("r5", "o5")];
const member: CommentActor = { type: "user", id: "member" };
const baseTask: CommentTask = {
  id: "task-1", projectId: "p1", status: "submitted", workstreamId: "ws-1", assignedAgentId: "worker",
  taskType: "content", points: null, workerOwnerId: "worker-owner", revisionCount: 0, maxRevisions: 2,
};
const approve = { type: "review", verdict: "approve", body: "Looks right." };
const changes = { type: "review", verdict: "changes", body: "Sources are missing." };
const delivery = { type: "delivery", body: "Updated draft", attachment: "https://example.com/draft" };

function harness(initial: CommentTask = baseTask) {
  let task = { ...initial };
  const comments: SavedTaskComment[] = [];
  const paid: string[] = [];
  let actor: CommentActor = reviewers[0];
  const store: TaskCommentStore = {
    findTask: async (id) => (task.id === id ? { ...task } : null),
    userInProject: async (userId, projectId) => userId === "member" && projectId === "p1",
    findComment: async (id) => comments.find((comment) => comment.id === id) ?? null,
    changeTask: async (_observed, change) => {
      task = { ...task, ...change } as CommentTask;
      return true;
    },
    createComment: async (data) => {
      const comment = {
        id: `c${comments.length + 1}`, taskId: data.taskId, type: data.type ?? "note", tag: null, title: null,
        body: data.body, attachment: data.attachment ?? null, score: null, verdict: data.verdict ?? null,
        parentId: data.parentId ?? null,
        authorAgentId: data.authorAgentId ?? null, authorUserId: data.authorUserId ?? null,
        authorAgent: null, authorUser: null, createdAt: new Date(), updatedAt: new Date(),
      } as SavedTaskComment;
      comments.push(comment);
      return comment;
    },
    roundReviews: async () => {
      const lastDelivery = comments.map((comment) => comment.type).lastIndexOf("delivery");
      return comments
        .slice(lastDelivery + 1)
        .filter((comment) => comment.type === "review")
        .map((comment): RoundReview => ({ authorAgentId: comment.authorAgentId, verdict: comment.verdict }));
    },
    payReview: async (_task, commentId) => { paid.push(`review:${commentId}`); },
    payTask: async (paidTask) => { paid.push(`task:${paidTask.id}`); },
  };
  const handler = createTaskCommentHandler({
    authenticate: async () => ({ actor, error: null }),
    transaction: (work) => work(store),
  });
  return {
    get task() { return task; }, comments, paid,
    async post(as: CommentActor, payload: unknown) {
      actor = as;
      return handler(new Request("http://localhost/api/tasks/task-1/comments", {
        method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" },
      }), { id: "task-1" });
    },
  };
}

describe("peer review verdicts", () => {
  it("approves the task on the second approval and pays the task and every review", async () => {
    const h = harness();
    assert.equal((await h.post(reviewers[0], approve)).status, 201);
    assert.equal(h.task.status, "in_review");
    assert.equal((await h.post(reviewers[1], changes)).status, 201);
    assert.equal(h.task.status, "in_review");
    assert.equal((await h.post(reviewers[2], approve)).status, 201);
    assert.equal(h.task.status, "approved");
    assert.deepEqual(h.paid, ["review:c1", "review:c2", "review:c3", "task:task-1"]);
  });

  it("sends the task back on two change verdicts, then reopens it after two failed rounds", async () => {
    const h = harness();
    for (const round of [1, 2]) {
      await h.post(reviewers[0], changes);
      await h.post(reviewers[1], changes);
      assert.equal(h.task.status, "changes_requested");
      assert.equal(h.task.revisionCount, round);
      assert.equal((await h.post(worker, delivery)).status, 201);
    }
    await h.post(reviewers[0], changes);
    await h.post(reviewers[1], changes);
    assert.equal(h.task.status, "reopened");
    assert.equal(h.task.assignedAgentId, null);
    assert.equal(h.task.revisionCount, 0);
  });

  it("lets each agent review a delivery once, and closes the round once decided", async () => {
    const h = harness({ ...baseTask, status: "in_review" });
    await h.post(reviewers[0], approve);
    assert.equal((await h.post(reviewers[0], changes)).status, 409);
    await h.post(reviewers[1], changes);
    await h.post(reviewers[2], { ...changes, verdict: "approve" });
    assert.equal(h.task.status, "approved");
    assert.equal((await h.post(reviewers[3], approve)).status, 400);

  });

  it("blocks the worker, agents sharing its owner, other projects and people", async () => {
    const h = harness();
    assert.equal((await h.post(worker, approve)).status, 403);
    assert.equal((await h.post(agent("sibling", "worker-owner"), approve)).status, 403);
    assert.equal((await h.post(agent("outsider", "o9", "p2"), approve)).status, 404);
    assert.equal((await h.post(member, approve)).status, 403);
    assert.equal((await h.post(member, { body: "Thanks, looking now." })).status, 201);
    assert.equal(h.task.status, "submitted");
  });

  it("needs a verdict and a reviewable delivery", async () => {
    const h = harness();
    assert.equal((await h.post(reviewers[0], { type: "review", body: "No call" })).status, 400);
    const open = harness({ ...baseTask, status: "in_progress" });
    assert.equal((await open.post(reviewers[0], approve)).status, 400);
    assert.equal((await h.post(reviewers[0], { type: "revision_request", body: "Redo" })).status, 400);
  });
});

describe("threaded replies", () => {
  it("keeps replies as notes one level deep, on the same task", async () => {
    const h = harness();
    assert.equal((await h.post(reviewers[0], approve)).status, 201);
    assert.equal((await h.post(worker, { body: "Which section?", parentId: "c1" })).status, 201);
    assert.equal((await h.post(member, { body: "The intro.", parentId: "c2" })).status, 201);
    assert.deepEqual(h.comments.map((comment) => comment.parentId), [null, "c1", "c1"], "a reply to a reply joins the top-level comment");

    assert.equal((await h.post(reviewers[1], { ...approve, parentId: "c1" })).status, 400, "reviews can't be replies");
    assert.equal((await h.post(worker, { body: "Hello?", parentId: "missing" })).status, 400);
    assert.equal(h.task.status, "in_review");
  });
});
