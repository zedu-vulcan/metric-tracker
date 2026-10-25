import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotifications, taskHref, type NotificationFeed } from "@/lib/notifications";
import { getOpenApiDocument } from "@/lib/openapi";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 21, 12, minutes));
const task = { id: "t1", title: "Fix the H1" };

const empty: NotificationFeed = {
  proposedTasks: [],
  biddingTasks: [],
  escalations: [],
  offers: [],
  decidedTasks: [],
  comments: [],
  points: [],
};

describe("Inbox notifications", () => {
  it("links tasks to their page", () => {
    assert.equal(taskHref(task), "/tasks/t1");
  });

  it("orders items newest first and marks the read ones", () => {
    const items = buildNotifications(
      {
        ...empty,
        proposedTasks: [{ task, createdAt: at(1) }],
        points: [{ id: "p1", amount: 0.5, reason: "review_submitted", note: null, agentName: "Quill", createdAt: at(5) }],
      },
      new Set(["points:p1"])
    );
    assert.deepEqual(items.map((item) => item.id), ["points:p1", "task-proposed:t1"]);
    assert.equal(items[0].read, true);
    assert.equal(items[0].title, "+0.5 points");
    assert.equal(items[1].read, false);
    assert.equal(items[1].needsAction, false);
    assert.equal(items[1].title, "Your task is up for a vote");
    assert.equal(
      items[1].message,
      "Your team and its agents are voting on “Fix the H1”. Enough upvotes open it for bids; enough downvotes remove it."
    );
  });

  it("changes the bids key when a new bid arrives, so it shows as unread again", () => {
    const build = (bidCount: number) =>
      buildNotifications({ ...empty, biddingTasks: [{ task, bidCount, lastBidAt: at(bidCount) }] }, new Set(["bids:t1:1"]));
    assert.equal(build(1)[0].read, true);
    assert.equal(build(2)[0].read, false);
    assert.equal(build(2)[0].message, "2 bids on “Fix the H1”. Pick an agent to offer it to.");
  });

  it("counts an open offer to your agent as waiting on you", () => {
    const [offer] = buildNotifications({ ...empty, offers: [{ task, agentName: "Bebz", offeredAt: at(3) }] }, new Set());
    assert.equal(offer.kind, "offer_received");
    assert.equal(offer.needsAction, true);
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

  it("describes reviews and decisions in plain words", () => {
    const [review, changes] = buildNotifications(
      {
        ...empty,
        comments: [
          { id: "c2", task, type: "review", isReply: false, authorName: "Scout", agentName: "Bebz", body: "", verdict: "changes", score: 6, createdAt: at(9) },
        ],
        decidedTasks: [{ task, status: "changes_requested", agentName: "Bebz", revisionCount: 1, updatedAt: at(7) }],
      },
      new Set()
    );
    assert.equal(review.message, "Scout asked for changes (6/10) on “Fix the H1”.");
    assert.equal(changes.id, "task-changes_requested:t1:1");
  });

  it("registers the people inbox endpoints with session auth", () => {
    const paths = getOpenApiDocument().paths ?? {};
    assert.deepEqual(paths["/api/notifications"]?.get?.security, [{ sessionCookie: [] }]);
    assert.ok(paths["/api/notifications/read"]?.post);
  });
});
