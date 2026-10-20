import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  workstreamAutoAcceptSchema,
  workstreamQuerySchema,
} from "@/lib/schemas/workstreams";
import {
  extractAgentApiKey,
  serializeAutoAcceptResponse,
  serializeWorkstreamDetail,
  serializeWorkstreamItem,
} from "@/lib/workstreams";
import { getOpenApiDocument } from "@/lib/openapi";

describe("Workstreams Validation, Serialization & OpenAPI", () => {
  it("defaults workstream query status to 'accepted' when omitted", () => {
    const parsed = workstreamQuerySchema.safeParse({});
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.status, "accepted");
      assert.equal(parsed.data.goalId, undefined);
    }
  });

  it("validates workstream query with explicit goalId and status", () => {
    const parsed = workstreamQuerySchema.safeParse({
      goalId: "goal-123",
      status: "proposed",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.goalId, "goal-123");
      assert.equal(parsed.data.status, "proposed");
    }
  });

  it("rejects workstream query with invalid status", () => {
    const parsed = workstreamQuerySchema.safeParse({
      status: "invalid_status",
    });
    assert.equal(parsed.success, false);
  });

  it("validates auto-accept payload with explicit boolean or empty toggle object", () => {
    const explicitTrue = workstreamAutoAcceptSchema.safeParse({ autoAcceptTasks: true });
    assert.equal(explicitTrue.success, true);
    if (explicitTrue.success) {
      assert.equal(explicitTrue.data.autoAcceptTasks, true);
    }

    const emptyToggle = workstreamAutoAcceptSchema.safeParse({});
    assert.equal(emptyToggle.success, true);
    if (emptyToggle.success) {
      assert.equal(emptyToggle.data.autoAcceptTasks, undefined);
    }

    const invalidType = workstreamAutoAcceptSchema.safeParse({ autoAcceptTasks: "yes" });
    assert.equal(invalidType.success, false);
  });

  it("extracts agent API key from X-Agent-Key or Authorization Bearer header", () => {
    const reqWithCustomHeader = new Request("http://localhost:3000/api/workstreams", {
      headers: { "x-agent-key": "agent-secret-1" },
    });
    assert.equal(extractAgentApiKey(reqWithCustomHeader), "agent-secret-1");

    const reqWithBearer = new Request("http://localhost:3000/api/workstreams", {
      headers: { Authorization: "Bearer agent-secret-2" },
    });
    assert.equal(extractAgentApiKey(reqWithBearer), "agent-secret-2");

    const reqWithoutKey = new Request("http://localhost:3000/api/workstreams");
    assert.equal(extractAgentApiKey(reqWithoutKey), null);
  });

  it("serializes workstream item, detail, and auto-accept response accurately", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const dummyWorkstream = {
      id: "ws-1",
      goalId: "goal-1",
      title: "On-page SEO",
      description: "Optimize metadata and headings",
      status: "accepted" as const,
      autoAcceptTasks: true,
      proposedByAgentId: "agent-1",
      acceptedById: "user-1",
      createdAt: now,
      updatedAt: now,
      goal: {
        id: "goal-1",
        title: "Make Zedu SEO compliant",
        description: "Full technical SEO audit",
        type: "seo" as const,
        status: "active" as const,
      },
      proposedByAgent: {
        id: "agent-1",
        name: "SEO Bot",
        speciality: "seo",
      },
      acceptedBy: {
        id: "user-1",
        name: "Jane Manager",
        email: "jane@zedu.chat",
      },
      _count: {
        tasks: 1,
      },
      tasks: [
        {
          id: "task-101",
          workstreamId: "ws-1",
          taskType: "seo",
          type: "Other" as const,
          title: "Fix H1 tags",
          description: "Ensure single H1 per page",
          status: "open" as const,
          assignedAgentId: null,
          offeredToAgentId: null,
          offeredAt: null,
          offerExpiresAt: null,
          revisionCount: 0,
          maxRevisions: 2,
          dueAt: null,
          done: false,
          completedAt: null,
          ownerId: null,
          userId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const item = serializeWorkstreamItem(dummyWorkstream);
    assert.equal(item.id, "ws-1");
    assert.equal(item.status, "accepted");
    assert.equal(item.autoAcceptTasks, true);
    assert.equal(item.taskCount, 1);
    assert.equal(item.createdAt, "2026-10-20T12:00:00.000Z");

    const detail = serializeWorkstreamDetail(dummyWorkstream);
    assert.equal(detail.tasks.length, 1);
    assert.equal(detail.tasks[0].id, "task-101");
    assert.equal(detail.tasks[0].taskType, "seo");
    assert.equal(detail.goal.description, "Full technical SEO audit");

    const autoAcceptRes = serializeAutoAcceptResponse(dummyWorkstream);
    assert.equal(autoAcceptRes.id, "ws-1");
    assert.equal(autoAcceptRes.autoAcceptTasks, true);
    assert.equal(autoAcceptRes.updatedAt, "2026-10-20T12:00:00.000Z");
  });

  it("registers workstreams endpoints in OpenAPI document", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/workstreams"]);
    assert.ok(doc.paths["/api/workstreams"].get);
    assert.ok(doc.paths["/api/workstreams/{id}"]);
    assert.ok(doc.paths["/api/workstreams/{id}"].get);
    assert.ok(doc.paths["/api/workstreams/{id}/auto-accept"]);
    assert.ok(doc.paths["/api/workstreams/{id}/auto-accept"].patch);
  });
});

