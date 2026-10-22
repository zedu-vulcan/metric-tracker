import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taskBoardQuerySchema, taskBoardStatusValues } from "@/lib/schemas/task-board";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";
import {
  clearTaskBoardFilter, getTaskBoardDraftFieldErrors, getTaskBoardFilterChange, getTaskBoardFilterChips,
  getTaskBoardFilterChoices, getTaskBoardFilterDrafts,
} from "@/components/task-board/task-board-filter-state";

const defaults = taskBoardQuerySchema.parse({});
const options = createTaskBoardFixtures().options;

describe("Task board filter drafts", () => {
  it("provides useful local messages while preserving the shared reversed-range error", () => {
    const invalid = getTaskBoardDraftFieldErrors(getTaskBoardFilterChange(defaults, { q: "", minPoints: "-", maxPoints: "" }));
    assert.match(invalid.minPoints?.[0] ?? "", /whole number from 0 to 2,147,483,647/);
    const reversed = getTaskBoardDraftFieldErrors(getTaskBoardFilterChange(defaults, { q: "", minPoints: "26", maxPoints: "25" }));
    assert.deepEqual(reversed.maxPoints, ["Maximum points must be at least minimum points"]);
    assert.deepEqual(getTaskBoardDraftFieldErrors(getTaskBoardFilterChange(defaults, getTaskBoardFilterDrafts(defaults))), {});
  });
  it("keeps absent bounds blank and preserves zero", () => {
    assert.deepEqual(getTaskBoardFilterDrafts(defaults), { q: "", minPoints: "", maxPoints: "" });
    assert.deepEqual(getTaskBoardFilterDrafts({ q: "a", minPoints: 0, maxPoints: 0 }), { q: "a", minPoints: "0", maxPoints: "0" });
  });
  it("emits only changed draft fields, trims outer whitespace and preserves inner spaces", () => {
    const value = taskBoardQuerySchema.parse({ status: "all", page: 3, agent: "mine" });
    const result = getTaskBoardFilterChange(value, { q: "  heading  structure  ", minPoints: "0", maxPoints: "25" });
    assert.ok(result.success);
    assert.deepEqual(result.data, { q: "heading  structure", minPoints: 0, maxPoints: 25 });
    assert.equal("page" in result.data, false);
    assert.equal("status" in result.data, false);
    assert.equal("agent" in result.data, false);
  });
  it("does not emit a duplicate patch for canonically identical drafts", () => {
    const value = taskBoardQuerySchema.parse({ q: "headings", minPoints: 0 });
    const result = getTaskBoardFilterChange(value, { q: " headings ", minPoints: "00", maxPoints: "" });
    assert.ok(result.success);
    assert.deepEqual(result.data, {});
  });
  it("clears a bound with explicit undefined rather than setting it to zero", () => {
    const value = taskBoardQuerySchema.parse({ minPoints: 10, maxPoints: 25 });
    const result = getTaskBoardFilterChange(value, { q: "", minPoints: "", maxPoints: "25" });
    assert.ok(result.success);
    assert.ok(Object.hasOwn(result.data, "minPoints"));
    assert.equal(result.data.minPoints, undefined);
    assert.equal("maxPoints" in result.data, false);
  });
  for (const raw of ["-", "-1", "1.5", "1e2", "Infinity", "2147483648"]) {
    it(`rejects a ${raw} numeric draft before it becomes a callback patch`, () => {
      const result = getTaskBoardFilterChange(defaults, { q: "", minPoints: raw, maxPoints: "" });
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.error.flatten().fieldErrors.minPoints);
    });
  }
  it("accepts inclusive equal bounds and rejects reversed bounds on maxPoints", () => {
    assert.ok(getTaskBoardFilterChange(defaults, { q: "", minPoints: "25", maxPoints: "25" }).success);
    const reversed = getTaskBoardFilterChange(defaults, { q: "", minPoints: "26", maxPoints: "25" });
    assert.equal(reversed.success, false);
    if (!reversed.success) assert.ok(reversed.error.flatten().fieldErrors.maxPoints);
  });
  it("accepts either bound independently and checks the search limit", () => {
    assert.ok(getTaskBoardFilterChange(defaults, { q: "", minPoints: "", maxPoints: "0" }).success);
    assert.ok(getTaskBoardFilterChange(defaults, { q: "", minPoints: "0", maxPoints: "" }).success);
    assert.ok(getTaskBoardFilterChange(defaults, { q: "x".repeat(200), minPoints: "", maxPoints: "" }).success);
    assert.equal(getTaskBoardFilterChange(defaults, { q: "x".repeat(201), minPoints: "", maxPoints: "" }).success, false);
  });
  it("flushes valid pending drafts atomically with a discrete selection", () => {
    const result = getTaskBoardFilterChange(defaults, { q: "pending search", minPoints: "0", maxPoints: "" }, { status: "all", goal: "goal_demo" });
    assert.ok(result.success);
    assert.deepEqual(result.data, { status: "all", goal: "goal_demo", q: "pending search", minPoints: 0 });
  });
  it("does not apply other selections while numeric drafts are invalid", () => {
    const result = getTaskBoardFilterChange(defaults, { q: "pending", minPoints: "50", maxPoints: "25" }, { agent: "mine" });
    assert.equal(result.success, false);
  });
  it("allows clearing the points chip to recover from invalid point drafts", () => {
    const value = taskBoardQuerySchema.parse({ minPoints: 10, maxPoints: 25 });
    const result = getTaskBoardFilterChange(value, { q: "", minPoints: "50", maxPoints: "25" }, clearTaskBoardFilter("points"));
    assert.ok(result.success);
    assert.deepEqual(result.data, { minPoints: undefined, maxPoints: undefined });
    assert.deepEqual(result.drafts, { q: "", minPoints: "", maxPoints: "" });
  });
});

describe("Task board choices and chips", () => {
  it("lists every exact status and aliases, with default availability first", () => {
    const choices = getTaskBoardFilterChoices(defaults, options);
    assert.deepEqual(choices.status.map((choice) => choice.value), [...taskBoardStatusValues]);
    assert.equal(choices.status[0].label, "Open for bids");
    assert.equal(choices.status.find((choice) => choice.value === "all")?.label, "All statuses");
  });
  it("distinguishes worker selectors, individual agents and their owners", () => {
    const agents = getTaskBoardFilterChoices(defaults, options).agent;
    assert.deepEqual(agents.slice(0, 3).map((choice) => choice.value), ["", "unassigned", "mine"]);
    assert.ok(agents.find((choice) => choice.value === "agent_demo_mine")?.label.includes("Demo member"));
    const missingName = getTaskBoardFilterChoices(defaults, { ...options, agents: [{ id: "a", name: "Worker", ownerName: null, isMine: true }] }).agent;
    assert.equal(missingName[3].label, "Worker — Owner name not set");
  });
  it("labels archived/historical types and completed/archived goals without removing them", () => {
    const choices = getTaskBoardFilterChoices(defaults, {
      ...options,
      types: [...options.types, { value: "old", label: "Old", isActive: false }],
      goals: [...options.goals, { id: "complete", title: "Finished", status: "completed" }, { id: "archive", title: "Past", status: "archived" }],
    });
    assert.equal(choices.type.find((choice) => choice.value === "old")?.label, "Old (archived)");
    assert.equal(choices.type.find((choice) => choice.value === "historical")?.label, "historical (historical)");
    assert.equal(choices.goal.find((choice) => choice.value === "complete")?.label, "Finished (completed)");
    assert.equal(choices.goal.find((choice) => choice.value === "archive")?.label, "Past (archived)");
  });
  it("retains unavailable URL selections and distinguishes loading from unavailable", () => {
    const value = taskBoardQuerySchema.parse({ type: "missing", goal: "missing_goal", agent: "missing_agent" });
    const empty = { types: [], goals: [], agents: [] };
    const choices = getTaskBoardFilterChoices(value, empty);
    for (const key of ["type", "goal", "agent"] as const) assert.ok(choices[key].some((choice) => choice.value === value[key] && choice.label.startsWith("Unavailable:")));
    assert.ok(getTaskBoardFilterChoices(value, empty, true).goal.some((choice) => choice.label === "Loading selection: missing_goal"));
  });
  it("does not mutate options or duplicate an existing selection", () => {
    const before = structuredClone(options);
    const value = taskBoardQuerySchema.parse({ type: "seo", goal: "goal_demo", agent: "mine" });
    const choices = getTaskBoardFilterChoices(value, options);
    assert.equal(choices.type.filter((choice) => choice.value === "seo").length, 1);
    assert.equal(choices.agent.filter((choice) => choice.value === "mine").length, 1);
    assert.deepEqual(options, before);
  });
  it("has no default availability or pagination chip", () => {
    assert.deepEqual(getTaskBoardFilterChips(defaults, options), []);
    assert.deepEqual(getTaskBoardFilterChips({ ...defaults, page: 3 }, options), []);
  });
  it("uses readable labels and represents zero and explicit all correctly", () => {
    const value = taskBoardQuerySchema.parse({ q: "heading", status: "all", type: "seo", goal: "goal_demo", agent: "mine", minPoints: 0, maxPoints: 0 });
    const chips = getTaskBoardFilterChips(value, options);
    assert.deepEqual(chips.map((chip) => chip.key), ["q", "status", "type", "goal", "agent", "points"]);
    assert.ok(chips.some((chip) => chip.label === "Status: All statuses"));
    assert.ok(chips.some((chip) => chip.label === "Assigned agent: My agents"));
    assert.ok(chips.some((chip) => chip.label === "Points: 0"));
    assert.ok(chips.some((chip) => chip.label === "Goal: Improve search visibility"));
  });
  it("labels open-ended ranges and clears only the intended filter", () => {
    assert.equal(getTaskBoardFilterChips({ ...defaults, minPoints: 0 }, options)[0].label, "Points: at least 0");
    assert.equal(getTaskBoardFilterChips({ ...defaults, maxPoints: 25 }, options)[0].label, "Points: up to 25");
    assert.equal(getTaskBoardFilterChips({ ...defaults, minPoints: 0, maxPoints: 25 }, options)[0].label, "Points: 0–25");
    assert.deepEqual(clearTaskBoardFilter("status"), { status: "open_for_bids" });
    assert.deepEqual(clearTaskBoardFilter("agent"), { agent: undefined });
    assert.deepEqual(clearTaskBoardFilter("q"), { q: "" });
    assert.deepEqual(clearTaskBoardFilter("goal"), { goal: undefined });
    assert.deepEqual(clearTaskBoardFilter("type"), { type: undefined });
  });
});
