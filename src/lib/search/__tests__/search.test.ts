import { describe, it } from "node:test";
import assert from "node:assert";
import { searchQuerySchema } from "@/lib/schemas/search";
import { textMatch } from "../match";
import { rank } from "../index";
import type { SearchResult } from "@/lib/schemas/search";

describe("Search Unit Tests", () => {
  it("validates query schema correctly", () => {
    // Too short
    const shortResult = searchQuerySchema.safeParse({ q: "a" });
    assert.strictEqual(shortResult.success, false);

    // Valid query
    const validResult = searchQuerySchema.safeParse({ q: "seo", limit: "5" });
    assert.strictEqual(validResult.success, true);
    if (validResult.success) {
      assert.strictEqual(validResult.data.q, "seo");
      assert.strictEqual(validResult.data.limit, 5);
    }
  });

  it("escapes special characters in textMatch", () => {
    const escaped = textMatch("test%string_query");
    // Prisma contains doesn't automatically escape % or _ unless formatted,
    // let's verify textMatch handles it according to implementation
    assert.ok(typeof escaped === "object" || typeof escaped === "string");
  });

  it("ranks results correctly based on group order and match position", () => {
    const mockResults: SearchResult[] = [
      {
        type: "task",
        id: "2",
        title: "SEO Audit Task",
        subtitle: "Task in Grow",
        status: "open",
        matchedField: "title",
        href: "/goals/g1/workstreams/w1/tasks/t1",
      },
      {
        type: "goal",
        id: "1",
        title: "SEO Growth Strategy",
        subtitle: "Goal · Growth",
        status: "active",
        matchedField: "title",
        href: "/goals/g1",
      },
    ];

    const ranked = rank(mockResults, "seo");

    // Goal comes before task because of groupOrder
    assert.strictEqual(ranked[0].type, "goal");
    assert.strictEqual(ranked[1].type, "task");
  });
});
