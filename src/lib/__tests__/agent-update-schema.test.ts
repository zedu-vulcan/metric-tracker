import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentUpdateSchema } from "@/lib/schemas/agents";

describe("agentUpdateSchema", () => {
  it("trims text values", () => {
    const result = agentUpdateSchema.safeParse({ name: "  Atlas  ", speciality: " SEO ", description: "  Writes briefs.  " });
    assert.ok(result.success);
    assert.deepEqual(result.data, { name: "Atlas", speciality: "SEO", description: "Writes briefs." });
  });

  it("rejects an empty or blank name and speciality", () => {
    assert.equal(agentUpdateSchema.safeParse({ name: "" }).success, false);
    assert.equal(agentUpdateSchema.safeParse({ name: "   " }).success, false);
    assert.equal(agentUpdateSchema.safeParse({ speciality: "" }).success, false);
    assert.equal(agentUpdateSchema.safeParse({ speciality: "   " }).success, false);
  });

  it("enforces the length limits (60 / 80 / 1500)", () => {
    assert.ok(agentUpdateSchema.safeParse({ name: "a".repeat(60) }).success);
    assert.equal(agentUpdateSchema.safeParse({ name: "a".repeat(61) }).success, false);
    assert.ok(agentUpdateSchema.safeParse({ speciality: "a".repeat(80) }).success);
    assert.equal(agentUpdateSchema.safeParse({ speciality: "a".repeat(81) }).success, false);
    assert.ok(agentUpdateSchema.safeParse({ description: "a".repeat(1500) }).success);
    assert.equal(agentUpdateSchema.safeParse({ description: "a".repeat(1501) }).success, false);
  });

  it("keeps an emptied description as an empty string and accepts null; the route stores both as null", () => {
    const emptied = agentUpdateSchema.safeParse({ description: "   " });
    assert.ok(emptied.success);
    assert.equal(emptied.data.description, "");
    const cleared = agentUpdateSchema.safeParse({ description: null });
    assert.ok(cleared.success);
    assert.equal(cleared.data.description, null);
  });

  it("rejects an empty object", () => {
    assert.equal(agentUpdateSchema.safeParse({}).success, false);
  });

  it("accepts a valid avatar and rejects a bad style or seed", () => {
    assert.ok(agentUpdateSchema.safeParse({ avatar: { style: "thumbs", seed: "abc123" } }).success);
    assert.equal(agentUpdateSchema.safeParse({ avatar: { style: "pixel-art", seed: "abc123" } }).success, false);
    assert.equal(agentUpdateSchema.safeParse({ avatar: { style: "thumbs", seed: "" } }).success, false);
  });
});
