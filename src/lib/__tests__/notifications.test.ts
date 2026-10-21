import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotifications, taskHref, type NotificationFeed } from "@/lib/notifications";
import { getOpenApiDocument } from "@/lib/openapi";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 21, 12, minutes));
const task = { id: "t1", title: "Fix the H1", goalId: "g1", workstreamId: "w1" };

const empty: NotificationFeed = {
  proposedIdeas: [],
  proposedTasks: [],
  biddingTasks: [],
  escalations: [],
  offers: [],
  decidedIdeas: [],
  decidedTasks: [],
  comments: [],
  points: [],
};

describe("Inbox notifications", () => {
  it("links tasks to their page, or to the goal when the path is incomplete", () => {
    assert.equal(taskHref(task), "/goals/g1/workstreams/w1/tasks/t1");
    assert.equal(taskHref({ ...task, workstreamId: null }), "/goals/g1");
    assert.equal(taskHref({ ...task, goalId: null }), "/goals");
  });

  it("orders items newest first and marks the read ones", () => {
    const items = buildNotifications(
      {
        ...empty,
        proposedIdeas: [{ id: "i1", title: "On-page SEO", goalId: "g1", goalTitle: "Rank", agentName: "Bebz", upvotes: 2, createdAt: at(1) }],
        points: [{ id: "p1", amount: 0.5, reason: "idea_upvoted", note: null, agentName: "Quill", createdAt: at(5) }],
      },
      new Set(["points:p1"])
    );
    assert.deepEqual(items.map((item) => item.id), ["points:p1", "idea:i1"]);
    assert.equal(items[0].read, true);
    assert.equal(items[0].title, "+0.5 points");
    assert.equal(items[1].read, false);
    assert.equal(items[1].needsAction, true);
    assert.match(items[1].message, /Bebz suggested “On-page SEO” for “Rank” · 2 upvotes\./);
  });

  it("changes the bids key when a new bid arrives, so it shows as unread again", () => {
    const build = (bidCount: number) =>
      buildNotifications({ ...empty, biddingTasks: [{ task, bidCount, lastBidAt: at(bidCount) }] }, new Set(["bids:t1:1"]));
    assert.equal(build(1)[0].read, true);
    assert.equal(build(2)[0].read, false);
    assert.equal(build(2)[0].message, "2 bids on “Fix the H1”. Pick an agent to offer it to.");
  });

  it("keeps everything waiting on you when updates fill the limit", () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      amount: 1,
      reason: "task_approved",
      note: null,
      agentName: null,
      createdAt: at(30 + index),
    }));
    const items = buildNotifications(
      { ...empty, points, escalations: [{ id: "c1", task, authorName: "Scout", body: "Which page?", createdAt: at(0) }] },
      new Set(),
      4
    );
    assert.equal(items.length, 4);
    assert.equal(items.at(-1)?.id, "comment:c1");
    assert.equal(items[0].message, "You earned 1 point: task approved.");
  });

  it("describes reviews, decisions and rejections in plain words", () => {
    const [review, rejected, changes] = buildNotifications(
      {
        ...empty,
        comments: [
          { id: "c2", task, type: "review", isReply: false, authorName: "Scout", agentName: "Bebz", body: "", verdict: "changes", score: 6, createdAt: at(9) },
        ],
        decidedIdeas: [{ id: "i2", title: "Backlinks", goalId: "g1", status: "rejected", agentName: "Bebz", reason: "Out of scope", updatedAt: at(8) }],
        decidedTasks: [{ task, status: "changes_requested", agentName: "Bebz", revisionCount: 1, updatedAt: at(7) }],
      },
      new Set()
    );
    assert.equal(review.message, "Scout asked for changes (6/10) on “Fix the H1”.");
    assert.equal(rejected.message, "Bebz's idea “Backlinks” wasn't taken up: Out of scope");
    assert.equal(changes.id, "task-changes_requested:t1:1");
  });

  it("registers the people inbox endpoints with session auth", () => {
    const paths = getOpenApiDocument().paths ?? {};
    assert.deepEqual(paths["/api/notifications"]?.get?.security, [{ sessionCookie: [] }]);
    assert.ok(paths["/api/notifications/read"]?.post);
  });
});
