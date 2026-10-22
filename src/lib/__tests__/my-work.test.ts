import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapStatusToTab,
  getWorkItemTab,
  normalizeWorkItems,
  type RawTaskRecord,
  type UnifiedWorkItem,
} from "@/lib/my-work";

describe("My Work - Status Mapping for Tabs", () => {
  it("maps PROPOSED and BID_PLACED to Applied tab", () => {
    assert.equal(mapStatusToTab("PROPOSED"), "applied");
    assert.equal(mapStatusToTab("BID_PLACED"), "applied");
    assert.equal(mapStatusToTab("bid_placed"), "applied");
    assert.equal(mapStatusToTab("bidding"), "applied");
    assert.equal(mapStatusToTab("open"), "applied");
  });

  it("maps APPROVED to Approved tab", () => {
    assert.equal(mapStatusToTab("APPROVED"), "approved");
    assert.equal(mapStatusToTab("approved"), "approved");
  });

  it("maps IN_PROGRESS to In progress tab", () => {
    assert.equal(mapStatusToTab("IN_PROGRESS"), "in_progress");
    assert.equal(mapStatusToTab("in_progress"), "in_progress");
  });

  it("maps OFFERED to Offered tab", () => {
    assert.equal(mapStatusToTab("OFFERED"), "offered");
    assert.equal(mapStatusToTab("offered"), "offered");
  });

  it("maps SUBMITTED and IN_REVIEW to In review tab", () => {
    assert.equal(mapStatusToTab("SUBMITTED"), "in_review");
    assert.equal(mapStatusToTab("submitted"), "in_review");
    assert.equal(mapStatusToTab("IN_REVIEW"), "in_review");
    assert.equal(mapStatusToTab("in_review"), "in_review");
  });

  it("maps CHANGES_REQUESTED to Changes requested tab", () => {
    assert.equal(mapStatusToTab("CHANGES_REQUESTED"), "changes_requested");
    assert.equal(mapStatusToTab("changes_requested"), "changes_requested");
  });

  it("maps REJECTED, DECLINED, and LOST to Lost / declined tab", () => {
    assert.equal(mapStatusToTab("REJECTED"), "lost");
    assert.equal(mapStatusToTab("DECLINED"), "lost");
    assert.equal(mapStatusToTab("declined"), "lost");
    assert.equal(mapStatusToTab("LOST"), "lost");
    assert.equal(mapStatusToTab("lost"), "lost");
  });

  it("resolves tab using getWorkItemTab helper", () => {
    const bidItem: Pick<UnifiedWorkItem, "status"> = { status: "BID_PLACED" };
    assert.equal(getWorkItemTab(bidItem), "applied");

    const taskItem: Pick<UnifiedWorkItem, "status"> = { status: "IN_PROGRESS" };
    assert.equal(getWorkItemTab(taskItem), "in_progress");
  });
});

describe("My Work - Task Normalization", () => {
  const userId = "user-123";

  it("turns tasks into a flat UnifiedWorkItem array sorted descending by updatedAt", () => {
    const rawTasks: RawTaskRecord[] = [
      {
        id: "task-1",
        number: 1,
        title: "Write blog post on programmatic SEO",
        status: "in_progress",
        points: 50,
        updatedAt: new Date("2026-10-21T12:00:00.000Z"),
        assignedAgent: {
          id: "agent-1",
          ownerId: userId,
          name: "SEO Pro",
          avatarStyle: "bottts",
          avatarSeed: "seo",
        },
      },
      {
        id: "task-2",
        number: 2,
        title: "Audit site technical tags",
        status: "open",
        points: 30,
        updatedAt: new Date("2026-10-21T15:00:00.000Z"),
        comments: [
          {
            type: "bid",
            authorAgentId: "agent-1",
            authorAgent: {
              id: "agent-1",
              name: "SEO Pro",
              avatarStyle: "bottts",
              avatarSeed: "seo",
            },
          },
        ],
      },
    ];

    const result = normalizeWorkItems(rawTasks, userId);

    assert.equal(result.length, 2);

    assert.equal(result[0].id, "task-2");
    assert.equal(result[0].ref, "T-2");
    assert.equal(result[0].status, "BID_PLACED");
    assert.equal(mapStatusToTab(result[0].status), "applied");
    assert.equal(result[0].points, 30);

    assert.equal(result[1].id, "task-1");
    assert.equal(result[1].status, "IN_PROGRESS");
    assert.equal(mapStatusToTab(result[1].status), "in_progress");
    assert.equal(result[1].points, 50);
  });

  it("handles offered, declined, and lost task states correctly", () => {
    const rawTasks: RawTaskRecord[] = [
      {
        id: "task-offered",
        number: 3,
        title: "Review PR strategy",
        status: "bidding",
        points: 40,
        updatedAt: new Date("2026-10-21T16:00:00.000Z"),
        offeredToAgent: {
          id: "agent-1",
          ownerId: userId,
          name: "SEO Pro",
          avatarStyle: "bottts",
          avatarSeed: "seo",
        },
      },
      {
        id: "task-declined",
        number: 4,
        title: "Run backlink audit",
        status: "bidding",
        points: 25,
        updatedAt: new Date("2026-10-21T11:00:00.000Z"),
        comments: [
          {
            type: "note",
            title: "Declined the offer",
            authorAgentId: "agent-1",
            authorAgent: {
              id: "agent-1",
              name: "SEO Pro",
              avatarStyle: "bottts",
              avatarSeed: "seo",
            },
          },
        ],
      },
    ];

    const result = normalizeWorkItems(rawTasks, userId);
    assert.equal(result.length, 2);

    assert.equal(result[0].id, "task-offered");
    assert.equal(result[0].status, "OFFERED");
    assert.equal(mapStatusToTab(result[0].status), "offered");

    assert.equal(result[1].id, "task-declined");
    assert.equal(result[1].status, "LOST");
    assert.equal(mapStatusToTab(result[1].status), "lost");
  });
});

