import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SearchResult } from "@/lib/schemas/search";
import { groupResults, matchesQuickAction, splitHighlight } from "./search-model";

const result = (type: SearchResult["type"], id: string): SearchResult => ({
  type,
  id,
  title: id,
  subtitle: null,
  status: null,
  matchedField: "title",
  href: "/tasks",
});

describe("search model helpers", () => {
  it("groups results in the fixed type order and preserves item order", () => {
    const groups = groupResults([
      result("task", "task-a"),
      result("agent", "agent-a"),
      result("task", "task-b"),
    ]);

    assert.deepEqual(groups.map((group) => group.type), ["task", "agent"]);
    assert.deepEqual(groups[0].results.map((item) => item.id), ["task-a", "task-b"]);
    assert.equal(groups[1].label, "Agents");
  });

  it("splits case-insensitive matches without treating query characters as regex", () => {
    assert.deepEqual(splitHighlight("SEO (audit) seo", "(AUDIT)"), [
      { text: "SEO ", match: false },
      { text: "(audit)", match: true },
      { text: " seo", match: false },
    ]);
    assert.deepEqual(splitHighlight("a.b", "."), [
      { text: "a", match: false },
      { text: ".", match: true },
      { text: "b", match: false },
    ]);
  });

  it("matches quick action labels against the trimmed query", () => {
    assert.equal(matchesQuickAction("New task", "  new "), true);
    assert.equal(matchesQuickAction("Create agent", "new"), false);
    assert.equal(matchesQuickAction("Create agent", "  "), true);
  });
});
