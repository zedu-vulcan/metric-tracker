import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ideaCreateSchema,
  ideaItemSchema,
  ideaStatusSchema,
} from "@/lib/schemas/ideas";
import { toIdeaItem, type IdeaRecord } from "@/lib/ideas";
import { getOpenApiDocument } from "@/lib/openapi";

describe("Ideas Validation, Serialization & OpenAPI", () => {
  it("validates valid idea creation payload", () => {
    const parsed = ideaCreateSchema.safeParse({
      title: "Write blog post on programmatic SEO",
      description: "Detailed guide for builders",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.title, "Write blog post on programmatic SEO");
      assert.equal(parsed.data.description, "Detailed guide for builders");
    }
  });

  it("validates idea creation with optional description omitted", () => {
    const parsed = ideaCreateSchema.safeParse({
      title: "Research competitors",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.title, "Research competitors");
      assert.equal(parsed.data.description, undefined);
    }
  });

  it("rejects empty title in idea creation", () => {
    const parsed = ideaCreateSchema.safeParse({
      title: "   ",
    });
    assert.equal(parsed.success, false);
  });

  it("validates idea statuses (proposed, accepted, rejected)", () => {
    assert.equal(ideaStatusSchema.safeParse("proposed").success, true);
    assert.equal(ideaStatusSchema.safeParse("accepted").success, true);
    assert.equal(ideaStatusSchema.safeParse("rejected").success, true);
    assert.equal(ideaStatusSchema.safeParse("unknown").success, false);
  });

  it("serializes idea record into idea item correctly", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    const mockRecord: IdeaRecord = {
      id: "ws-idea-1",
      goalId: "goal-1",
      title: "Automate Directory Submissions",
      description: "Pitch 50 SaaS directories automatically",
      status: "proposed",
      autoAcceptTasks: false,
      proposedByAgentId: "agent-1",
      proposedByAgent: {
        id: "agent-1",
        name: "Outreach Bot",
        speciality: "outreach",
      },
      acceptedById: null,
      acceptedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const serialized = toIdeaItem(mockRecord);
    assert.equal(serialized.id, "ws-idea-1");
    assert.equal(serialized.goalId, "goal-1");
    assert.equal(serialized.title, "Automate Directory Submissions");
    assert.equal(serialized.status, "proposed");
    assert.equal(serialized.proposedByAgent?.name, "Outreach Bot");
    assert.equal(serialized.acceptedById, null);
    assert.equal(serialized.createdAt, "2026-10-20T12:00:00.000Z");

    const schemaCheck = ideaItemSchema.safeParse(serialized);
    assert.equal(schemaCheck.success, true);
  });

  it("registers ideas endpoints in OpenAPI document", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths, "paths object exists in OpenAPI doc");

    assert.ok(doc.paths["/api/goals/{id}/ideas"], "/api/goals/{id}/ideas registered");
    assert.ok(doc.paths["/api/goals/{id}/ideas"]?.post, "POST /api/goals/{id}/ideas registered");

    assert.ok(doc.paths["/api/ideas/{id}/accept"], "/api/ideas/{id}/accept registered");
    assert.ok(doc.paths["/api/ideas/{id}/accept"]?.post, "POST /api/ideas/{id}/accept registered");

    assert.ok(doc.paths["/api/ideas/{id}/reject"], "/api/ideas/{id}/reject registered");
    assert.ok(doc.paths["/api/ideas/{id}/reject"]?.post, "POST /api/ideas/{id}/reject registered");
  });
});
