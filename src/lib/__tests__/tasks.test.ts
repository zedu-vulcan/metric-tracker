import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  taskCreateSchema,
  taskUpdateSchema,
  offerAcceptSchema,
  offerCreateSchema,
  taskOfferedSchema,
  goalTaskCreateSchema,
} from "@/lib/schemas/tasks";
import { commentCreateSchema } from "@/lib/schemas/comments";
import { serializeTask, serializeTaskOffered } from "@/lib/tasks";
import { getOpenApiDocument } from "@/lib/openapi";

describe("goalTaskCreateSchema", () => {
  it("validates valid task creation payload", () => {
    const result = goalTaskCreateSchema.safeParse({
      title: "Write blog post",
      description: "SEO optimized content",
      taskType: "content",
    });
    assert.equal(result.success, true);
  });

  it("rejects missing title", () => {
    const result = goalTaskCreateSchema.safeParse({
      taskType: "research",
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid taskType", () => {
    const result = goalTaskCreateSchema.safeParse({
      title: "Invalid type task",
      taskType: "invalid_type",
    });
    assert.equal(result.success, false);
  });
});

describe("OpenAPI Documentation", () => {
  it("includes POST /api/workstreams/{id}/tasks route", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/workstreams/{id}/tasks"]);
    assert.ok(doc.paths["/api/workstreams/{id}/tasks"].post);
  });
});

describe("Tasks Validation & Serialization", () => {
  it("validates valid task creation payload with defaults", () => {
    const input = {
      title: "Write documentation",
      dueAt: "2026-10-25T14:00:00.000Z",
    };
    const parsed = taskCreateSchema.safeParse(input);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.title, "Write documentation");
      assert.equal(parsed.data.type, "Other");
      assert.equal(parsed.data.assignToMe, true);
    }
  });

  it("handles explicit assignToMe: false", () => {
    const input = {
      title: "Team meeting",
      type: "Meeting",
      dueAt: "2026-10-25T14:00:00.000Z",
      assignToMe: false,
    };
    const parsed = taskCreateSchema.safeParse(input);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.assignToMe, false);
      assert.equal(parsed.data.type, "Meeting");
    }
  });

  it("rejects task creation with missing title or invalid dueAt", () => {
    const emptyTitle = taskCreateSchema.safeParse({
      title: "   ",
      dueAt: "2026-10-25T14:00:00.000Z",
    });
    assert.equal(emptyTitle.success, false);

    const invalidDate = taskCreateSchema.safeParse({
      title: "Task with bad date",
      dueAt: "not-a-date",
    });
    assert.equal(invalidDate.success, false);
  });

  it("validates task updates and rejects empty updates", () => {
    const validUpdate = taskUpdateSchema.safeParse({ done: true });
    assert.equal(validUpdate.success, true);

    const emptyUpdate = taskUpdateSchema.safeParse({});
    assert.equal(emptyUpdate.success, false);
  });

  it("serializes task correctly with ISO dates and relations", () => {
    const dummyTask = {
      id: "task-1",
      workstreamId: null,
      taskType: null,
      title: "Follow up with client",
      description: "Discuss pricing",
      type: "FollowUp" as const,
      status: "proposed" as const,
      assignedAgentId: null,
      offeredToAgentId: null,
      offeredAt: null,
      offerExpiresAt: null,
      revisionCount: 0,
      maxRevisions: 2,
      dueAt: new Date("2026-10-25T14:00:00.000Z"),
      done: false,
      completedAt: null,
      ownerId: "user-1",
      userId: "user-creator",
      owner: {
        id: "user-1",
        name: "Jane Doe",
        email: "jane@example.com",
      },
      user: {
        id: "user-creator",
        name: "Admin User",
        email: "admin@example.com",
      },
      createdAt: new Date("2026-10-20T10:00:00.000Z"),
      updatedAt: new Date("2026-10-20T10:00:00.000Z"),
    };

    const serialized = serializeTask(dummyTask);
    assert.equal(serialized.id, "task-1");
    assert.equal(serialized.dueAt, "2026-10-25T14:00:00.000Z");
    assert.equal(serialized.completedAt, null);
    assert.equal(serialized.owner?.name, "Jane Doe");
    assert.equal(serialized.user?.name, "Admin User");
  });

  it("validates offer creation payload and rejects empty agentId", () => {
    const valid = offerCreateSchema.safeParse({ agentId: "agent-123" });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.agentId, "agent-123");
    }

    const empty = offerCreateSchema.safeParse({ agentId: "   " });
    assert.equal(empty.success, false);

    const missing = offerCreateSchema.safeParse({});
    assert.equal(missing.success, false);
  });

  it("validates offer acceptance schema", () => {
    const parsed = offerAcceptSchema.safeParse({});
    assert.equal(parsed.success, true);
  });

  it("serializes task offered record with Date objects into ISO strings correctly", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const expiry = new Date("2026-10-21T12:00:00.000Z");

    const rawPrismaTask = {
      id: "task-456",
      status: "bidding",
      offeredToAgentId: "agent-abc",
      offeredAt: now,
      offerExpiresAt: expiry,
      assignedAgentId: null,
    };

    const serialized = serializeTaskOffered(rawPrismaTask);
    assert.equal(serialized.id, "task-456");
    assert.equal(serialized.status, "bidding");
    assert.equal(serialized.offeredToAgentId, "agent-abc");
    assert.equal(serialized.offeredAt, "2026-10-20T12:00:00.000Z");
    assert.equal(serialized.offerExpiresAt, "2026-10-21T12:00:00.000Z");
    assert.equal(serialized.assignedAgentId, null);

    const validated = taskOfferedSchema.safeParse(serialized);
    assert.equal(validated.success, true);
  });

  it("registers tasks endpoints in OpenAPI document", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/tasks"]);
    assert.ok(doc.paths["/api/tasks"].get);
    assert.ok(doc.paths["/api/tasks"].post);
    assert.ok(doc.paths["/api/tasks/{id}"]);
    assert.ok(doc.paths["/api/tasks/{id}"].get);
    assert.ok(doc.paths["/api/tasks/{id}"].patch);
    assert.ok(doc.paths["/api/tasks/{id}"].delete);
    assert.ok(doc.paths["/api/tasks/{id}/offer"]);
    assert.ok(doc.paths["/api/tasks/{id}/offer"]?.post);
    assert.ok(doc.paths["/api/tasks/{id}/accept-offer"]);
    assert.ok(doc.paths["/api/tasks/{id}/accept-offer"]?.post);
  });
});

describe("Comment Validation & Registration", () => {
  it("validates a valid review comment payload", () => {
    const parsed = commentCreateSchema.safeParse({
      type: "review",
      tag: "seo",
      title: "Peer review",
      body: "Looks good overall.",
      score: 8,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.type, "review");
      assert.equal(parsed.data.score, 8);
    }
  });

  it("rejects review with missing body", () => {
    assert.equal(commentCreateSchema.safeParse({ type: "review" }).success, false);
  });

  it("rejects review score outside 1-10", () => {
    assert.equal(
      commentCreateSchema.safeParse({ type: "review", body: "ok", score: 0 }).success,
      false
    );
    assert.equal(
      commentCreateSchema.safeParse({ type: "review", body: "ok", score: 11 }).success,
      false
    );
  });

  it("registers comments endpoint in OpenAPI document", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/tasks/{id}/comments"]);
    assert.ok(doc.paths["/api/tasks/{id}/comments"].post);
  });
});
