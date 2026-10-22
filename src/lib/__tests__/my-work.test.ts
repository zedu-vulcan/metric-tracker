import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapStatusToTab,
  getWorkItemTab,
  normalizeWorkItems,
  type RawIdeaRecord,
  type RawTaskRecord,
  type UnifiedWorkItem,
} from "@/lib/my-work";

describe("My Work - Status Mapping for Tabs", () => {
  it("maps PROPOSED and BID_PLACED to Applied tab", () => {
    assert.equal(mapStatusToTab("PROPOSED", "idea"), "applied");
    assert.equal(mapStatusToTab("proposed", "idea"), "applied");
    assert.equal(mapStatusToTab("BID_PLACED", "task"), "applied");
    assert.equal(mapStatusToTab("bid_placed", "task"), "applied");
    assert.equal(mapStatusToTab("bidding", "task"), "applied");
    assert.equal(mapStatusToTab("open", "task"), "applied");
  });

  it("maps ACCEPTED (for ideas) and APPROVED (for tasks) to Approved tab", () => {
    assert.equal(mapStatusToTab("ACCEPTED", "idea"), "approved");
    assert.equal(mapStatusToTab("accepted", "idea"), "approved");
    assert.equal(mapStatusToTab("APPROVED", "task"), "approved");
    assert.equal(mapStatusToTab("approved", "task"), "approved");
  });

  it("maps IN_PROGRESS to In progress tab", () => {
    assert.equal(mapStatusToTab("IN_PROGRESS", "task"), "in_progress");
    assert.equal(mapStatusToTab("in_progress", "task"), "in_progress");
  });

  it("maps OFFERED to Offered tab", () => {
    assert.equal(mapStatusToTab("OFFERED", "task"), "offered");
    assert.equal(mapStatusToTab("offered", "task"), "offered");
  });

  it("maps SUBMITTED and IN_REVIEW to In review tab", () => {
    assert.equal(mapStatusToTab("SUBMITTED", "task"), "in_review");
    assert.equal(mapStatusToTab("submitted", "task"), "in_review");
    assert.equal(mapStatusToTab("IN_REVIEW", "task"), "in_review");
    assert.equal(mapStatusToTab("in_review", "task"), "in_review");
  });

  it("maps CHANGES_REQUESTED to Changes requested tab", () => {
    assert.equal(mapStatusToTab("CHANGES_REQUESTED", "task"), "changes_requested");
    assert.equal(mapStatusToTab("changes_requested", "task"), "changes_requested");
  });

  it("maps REJECTED, DECLINED, and LOST to Lost / declined tab", () => {
    assert.equal(mapStatusToTab("REJECTED", "idea"), "lost");
    assert.equal(mapStatusToTab("rejected", "idea"), "lost");
    assert.equal(mapStatusToTab("DECLINED", "task"), "lost");
    assert.equal(mapStatusToTab("declined", "task"), "lost");
    assert.equal(mapStatusToTab("LOST", "task"), "lost");
    assert.equal(mapStatusToTab("lost", "task"), "lost");
  });

  it("resolves tab using getWorkItemTab helper", () => {
    const ideaItem: Pick<UnifiedWorkItem, "status" | "type"> = {
      type: "idea",
      status: "PROPOSED",
    };
    assert.equal(getWorkItemTab(ideaItem), "applied");

    const taskItem: Pick<UnifiedWorkItem, "status" | "type"> = {
      type: "task",
      status: "IN_PROGRESS",
    };
    assert.equal(getWorkItemTab(taskItem), "in_progress");
  });
});

describe("My Work - Unified Data Normalization", () => {
  const userId = "user-123";

  it("merges ideas and tasks into a flat UnifiedWorkItem array sorted descending by updatedAt", () => {
    const rawIdeas: RawIdeaRecord[] = [
      {
        id: "idea-1",
        title: "Programmatic SEO Directory Outreach",
        status: "proposed",
        goalId: "goal-1",
        updatedAt: new Date("2026-10-21T10:00:00.000Z"),
        goal: { id: "goal-1", title: "Launch Marketing Engine" },
        proposedByAgent: {
          id: "agent-1",
          name: "SEO Pro",
          avatarStyle: "bottts",
          avatarSeed: "seo",
        },
      },
      {
        id: "idea-2",
        title: "Cold Email Funnel Strategy",
        status: "accepted",
        goalId: "goal-1",
        updatedAt: new Date("2026-10-21T14:00:00.000Z"),
        goal: { id: "goal-1", title: "Launch Marketing Engine" },
        proposedByAgent: {
          id: "agent-1",
          name: "SEO Pro",
          avatarStyle: "bottts",
          avatarSeed: "seo",
        },
      },
    ];

    const rawTasks: RawTaskRecord[] = [
      {
        id: "task-1",
        title: "Write blog post on programmatic SEO",
        status: "in_progress",
        points: 50,
        updatedAt: new Date("2026-10-21T12:00:00.000Z"),
        workstream: {
          id: "ws-1",
          title: "Content Marketing",
          goal: { id: "goal-1", title: "Launch Marketing Engine" },
        },
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
        title: "Audit site technical tags",
        status: "open",
        points: 30,
        updatedAt: new Date("2026-10-21T15:00:00.000Z"),
        workstream: {
          id: "ws-2",
          title: "Technical SEO",
          goal: { id: "goal-1", title: "Launch Marketing Engine" },
        },
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

    const result = normalizeWorkItems(rawIdeas, rawTasks, userId);

    assert.equal(result.length, 4);

    // Verify sorted descending by updatedAt:
    // 1. task-2 at 15:00:00
    // 2. idea-2 at 14:00:00
    // 3. task-1 at 12:00:00
    // 4. idea-1 at 10:00:00
    assert.equal(result[0].id, "task-2");
    assert.equal(result[0].type, "task");
    assert.equal(result[0].status, "BID_PLACED");
    assert.equal(mapStatusToTab(result[0].status, result[0].type), "applied");
    assert.equal(result[0].points, 30);
    assert.equal(result[0].breadcrumbs.goalTitle, "Launch Marketing Engine");
    assert.equal(result[0].breadcrumbs.workstreamTitle, "Technical SEO");

    assert.equal(result[1].id, "idea-2");
    assert.equal(result[1].type, "idea");
    assert.equal(result[1].status, "ACCEPTED");
    assert.equal(mapStatusToTab(result[1].status, result[1].type), "approved");
    assert.equal(result[1].points, 3);
    assert.equal(result[1].breadcrumbs.goalTitle, "Launch Marketing Engine");

    assert.equal(result[2].id, "task-1");
    assert.equal(result[2].type, "task");
    assert.equal(result[2].status, "IN_PROGRESS");
    assert.equal(mapStatusToTab(result[2].status, result[2].type), "in_progress");
    assert.equal(result[2].points, 50);

    assert.equal(result[3].id, "idea-1");
    assert.equal(result[3].type, "idea");
    assert.equal(result[3].status, "PROPOSED");
    assert.equal(mapStatusToTab(result[3].status, result[3].type), "applied");
    assert.equal(result[3].points, null);
  });

  it("handles offered, declined, and lost task states correctly", () => {
    const rawTasks: RawTaskRecord[] = [
      {
        id: "task-offered",
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

    const result = normalizeWorkItems([], rawTasks, userId);
    assert.equal(result.length, 2);

    assert.equal(result[0].id, "task-offered");
    assert.equal(result[0].status, "OFFERED");
    assert.equal(mapStatusToTab(result[0].status, result[0].type), "offered");

    assert.equal(result[1].id, "task-declined");
    assert.equal(result[1].status, "LOST");
    assert.equal(mapStatusToTab(result[1].status, result[1].type), "lost");
  });
});

