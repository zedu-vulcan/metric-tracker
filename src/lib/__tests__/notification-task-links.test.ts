import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import { buildNotifications, type NotificationFeed } from "@/lib/notifications";
import { getNotifications } from "@/lib/notifications-server";
import { prisma } from "@/lib/prisma";

const now = new Date("2026-11-02T00:00:00Z");
const task = { id: "task-1", title: "Improve onboarding" };
const point = { id: "point-1", amount: 250, reason: "task_approved", note: null, agentName: "Scout", createdAt: now };
const empty: NotificationFeed = {
  proposedTasks: [], biddingTasks: [], escalations: [], offers: [], decidedTasks: [], comments: [], points: [],
};

const restore: (() => void)[] = [];

// Prisma delegates are proxies, so install test doubles through their setter.
function stub<Args extends unknown[], Result>(target: object, name: string, implementation: (...args: Args) => Result) {
  const original = Reflect.get(target, name);
  const replacement = mock.fn(implementation);
  Reflect.set(target, name, replacement);
  restore.push(() => { Reflect.set(target, name, original); });
  return replacement;
}

afterEach(() => { restore.splice(0).reverse().forEach((reset) => reset()); });

it("opens the source task for points while preserving the notification's read key and text", () => {
  const [item] = buildNotifications({ ...empty, points: [{ ...point, task }] }, new Set(["points:point-1"]));
  assert.equal(item.href, "/tasks/task-1");
  assert.equal(item.id, "points:point-1");
  assert.equal(item.read, true);
  assert.equal(item.title, "+250 points");
  assert.equal(item.message, "Scout earned 250 points: task approved.");
});

it("keeps Agents as the fallback when a points notification has no surviving task", () => {
  for (const source of [undefined, null]) {
    const [item] = buildNotifications({ ...empty, points: [{ ...point, task: source }] }, new Set());
    assert.equal(item.href, "/profile?tab=agents");
  }
});

it("keeps review and approval notifications linked to their own task", () => {
  const items = buildNotifications({
    ...empty,
    decidedTasks: [{ task, status: "approved", agentName: "Scout", revisionCount: 0, updatedAt: now }],
    comments: [{ id: "review-1", task, type: "review", isReply: false, authorName: "Reviewer", agentName: "Scout", body: "", verdict: "approve", score: 8, createdAt: now }],
  }, new Set());
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.href === "/tasks/task-1"));
});

it("resolves task, review and vote ledger sources in the active project, with safe fallbacks", async () => {
  stub(prisma.agent, "findMany", async () => []);
  const taskQuery = stub(prisma.task, "findMany", async (args: { where: { id?: { in: string[] } } }) =>
    args.where.id ? [task] : []
  );
  const commentQuery = stub(prisma.taskComment, "findMany", async (args: { where: { id?: { in: string[] } } }) =>
    args.where.id ? [{ id: "review-1", task }] : []
  );
  const voteQuery = stub(prisma.taskVote, "findMany", async (_args: unknown) => [{ id: "vote-1", task }]);
  const sources = [
    ["task", task.id], ["comment", "review-1"], ["vote", "vote-1"],
    ["task", "deleted-task"], ["idea", task.id], [null, null],
  ];
  stub(prisma.pointsLedger, "findMany", async () => sources.map(([sourceType, sourceId], index) => ({
    ...point, id: `point-${index}`, sourceType, sourceId, agent: { name: "Scout" },
  })));
  stub(prisma.inboxRead, "findMany", async () => [{ itemKey: "points:point-0" }]);

  const result = await getNotifications("owner-1", "project-1", now);
  assert.deepEqual(result.items.map((item) => item.href), [
    "/tasks/task-1", "/tasks/task-1", "/tasks/task-1",
    "/profile?tab=agents", "/profile?tab=agents", "/profile?tab=agents",
  ]);
  assert.equal(result.unreadCount, 5);
  assert.equal(result.items[0].read, true);
  assert.deepEqual(taskQuery.mock.calls.at(-1)?.arguments[0], {
    where: { projectId: "project-1", id: { in: [task.id, "deleted-task"] } },
    select: { id: true, title: true },
  });
  assert.deepEqual(commentQuery.mock.calls.at(-1)?.arguments[0], {
    where: { task: { projectId: "project-1" }, id: { in: ["review-1"] } },
    select: { id: true, task: { select: { id: true, title: true } } },
  });
  assert.deepEqual(voteQuery.mock.calls[0]?.arguments[0], {
    where: { task: { projectId: "project-1" }, id: { in: ["vote-1"] } },
    select: { id: true, task: { select: { id: true, title: true } } },
  });
});
