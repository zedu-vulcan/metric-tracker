import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";
import { applyTaskBoardFilterChange, buildTaskBoardShareUrl, parseTaskBoardSearch, serializeTaskBoardQuery } from "@/lib/task-board-url";

describe("task board URL integration", () => {
  it("round-trips combined filters, explicit all statuses and a zero bound", () => {
    const parsed = parseTaskBoardSearch("status=all&q=+heading+&type=seo&goal=goal_demo&agent=mine&minPoints=0&maxPoints=25&page=2&extra=ignored");
    assert.ok(parsed.success);
    const canonical = serializeTaskBoardQuery(parsed.data);
    assert.equal(canonical, "q=heading&status=all&type=seo&goal=goal_demo&agent=mine&minPoints=0&maxPoints=25&page=2");
    const restored = parseTaskBoardSearch(canonical);
    assert.ok(restored.success);
    assert.deepEqual(restored.data, parsed.data);
  });

  it("omits defaults and empty values while preserving zero", () => {
    const parsed = parseTaskBoardSearch("q=&status=&minPoints=0&page=1&unknown=discard");
    assert.ok(parsed.success);
    assert.equal(serializeTaskBoardQuery(parsed.data), "minPoints=0");
  });

  it("applies delayed filter patches to the latest URL state and resets pagination", () => {
    const latest = parseTaskBoardSearch("status=all&agent=mine&page=4");
    assert.ok(latest.success);

    const changed = applyTaskBoardFilterChange(latest.data, { q: "heading" });
    assert.equal(changed.page, 1);
    assert.equal(serializeTaskBoardQuery(changed), "q=heading&status=all&agent=mine");
  });

  it("keeps invalid and duplicate values invalid for the page boundary", () => {
    assert.equal(parseTaskBoardSearch("status=all&status=open").success, false);
    assert.equal(parseTaskBoardSearch("minPoints=9&maxPoints=2").success, false);
    assert.equal(parseTaskBoardSearch("status=unknown").success, false);
  });

  it("builds a share link with the current project path and page", () => {
    const parsed = parseTaskBoardSearch("status=all&minPoints=0&page=3&unknown=x");
    assert.ok(parsed.success);
    assert.equal(
      buildTaskBoardShareUrl("/p/demo/tasks", "https://amp.example", parsed.data),
      "https://amp.example/p/demo/tasks?status=all&minPoints=0&page=3",
    );
  });

  it("uses fixture options and task payloads that satisfy the same wire schemas", () => {
    const fixtures = createTaskBoardFixtures();
    const parsed = parseTaskBoardSearch("status=all&agent=mine");
    assert.ok(parsed.success);
    assert.equal(parsed.data.status, "all");
    assert.ok(fixtures.options.agents.some((agent) => agent.isMine));
    assert.ok(fixtures.allStatusesResponse.tasks.some((task) => task.detailsUrl === null));
  });
});
