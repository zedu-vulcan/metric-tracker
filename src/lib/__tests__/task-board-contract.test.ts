import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseTaskBoardQuery, taskBoardQuerySchema, taskBoardQueryKeys,
  taskBoardResponseSchema, taskBoardOptionsSchema, taskBoardTaskSchema,
  taskBoardStatusValues, TASK_BOARD_MAX_PAGE, TASK_BOARD_MAX_POINTS,
} from "@/lib/schemas/task-board";
import { createTaskBoardFixtures } from "@/lib/fixtures/task-board";

const parse = (query: string) => parseTaskBoardQuery(new URLSearchParams(query));

describe("Task board query contract", () => {
  it("defaults to Open for bids and page one", () => {
    const result = parse("");
    assert.ok(result.success);
    assert.equal(result.data.status, "open_for_bids");
    assert.equal(result.data.page, 1);
    assert.equal(result.data.q, "");
    assert.equal(result.data.minPoints, undefined);
  });
  it("preserves explicit all, trims search, and accepts combined filters including zero", () => {
    const result = parse("status=all&q=+heading+structure+&type=seo&goal=goal_demo&agent=mine&minPoints=0&maxPoints=25&page=2");
    assert.ok(result.success);
    assert.deepEqual(result.data, { status: "all", q: "heading structure", type: "seo", goal: "goal_demo", agent: "mine", minPoints: 0, maxPoints: 25, page: 2 });
  });
  it("treats blank filters as omitted rather than zero", () => {
    const result = parse("q=+&status=&type=&goal=&agent=&minPoints=&maxPoints=+&page=");
    assert.ok(result.success);
    assert.equal(result.data.page, 1);
    assert.equal(result.data.status, "open_for_bids");
    assert.equal(result.data.minPoints, undefined);
    assert.equal(result.data.maxPoints, undefined);
  });
  it("accepts every real status and the two aliases", () => {
    for (const status of taskBoardStatusValues) assert.ok(parse(`status=${status}`).success, status);
  });
  it("accepts worker selectors and opaque IDs", () => {
    for (const agent of ["mine", "unassigned", "agent_demo"]) assert.ok(parse(`agent=${agent}`).success);
  });
  it("rejects duplicate recognized keys, even blanks or equal values", () => {
    for (const key of taskBoardQueryKeys) {
      const result = parse(`${key}=&${key}=`);
      assert.equal(result.success, false, key);
      if (!result.success) assert.ok(result.error.flatten().fieldErrors[key]);
    }
  });
  it("ignores unknown keys without accepting an owner override", () => {
    const result = parse("ownerId=someone&unknown=a&unknown=b&status=all");
    assert.ok(result.success);
    assert.equal("ownerId" in result.data, false);
    assert.equal("unknown" in result.data, false);
  });
  it("validates integer boundaries and reports reversed ranges on maxPoints", () => {
    assert.ok(parse(`minPoints=0&maxPoints=${TASK_BOARD_MAX_POINTS}&page=${TASK_BOARD_MAX_PAGE}`).success);
    assert.ok(parse("minPoints=25&maxPoints=25").success);
    const reversed = parse("minPoints=26&maxPoints=25");
    assert.equal(reversed.success, false);
    if (!reversed.success) assert.ok(reversed.error.flatten().fieldErrors.maxPoints);
    for (const value of ["-1", "1.5", "1e2", "0x10", "Infinity", "NaN", "2147483648"]) {
      assert.equal(parse(`minPoints=${value}`).success, false, value);
      assert.equal(parse(`maxPoints=${value}`).success, false, value);
    }
    for (const value of ["0", "-1", "1.5", String(TASK_BOARD_MAX_PAGE + 1)]) assert.equal(parse(`page=${value}`).success, false);
  });
  it("rejects unsupported status, invalid slugs and oversized text/IDs", () => {
    for (const query of ["status=done", "type=SEO!", `type=${"s".repeat(61)}`, `q=${"a".repeat(201)}`, `goal=${"a".repeat(201)}`, `agent=${"a".repeat(201)}`]) assert.equal(parse(query).success, false);
    assert.ok(parse(`q=${"a".repeat(200)}`).success);
  });
  it("supports already parsed typed values without coercing booleans/null", () => {
    assert.ok(taskBoardQuerySchema.safeParse({ minPoints: 0, page: 2 }).success);
    assert.equal(taskBoardQuerySchema.safeParse({ minPoints: null }).success, false);
    assert.equal(taskBoardQuerySchema.safeParse({ page: true }).success, false);
  });
});

describe("Task board response contract and fictional fixtures", () => {
  it("accepts the shared response/options including legacy and unknown-point rows", () => {
    const fixtures = createTaskBoardFixtures();
    assert.ok(taskBoardResponseSchema.safeParse(fixtures.allStatusesResponse).success);
    assert.ok(taskBoardOptionsSchema.safeParse(fixtures.options).success);
    const legacy = fixtures.allStatusesResponse.tasks.find((task) => task.id === "task_demo_legacy");
    assert.ok(legacy);
    assert.equal(legacy.goal, null);
    assert.equal(legacy.detailsUrl, null);
    assert.equal(legacy.points, null);
    assert.equal(legacy.isOpenForBids, false);
  });
  it("preserves zero and distinguishes pending/expired offers", () => {
    const { allStatusesResponse: { tasks }, now } = createTaskBoardFixtures();
    assert.equal(tasks.find((task) => task.id === "task_demo_zero")?.points, 0);
    assert.equal(tasks.find((task) => task.id === "task_demo_pending")?.offerPending, true);
    assert.equal(tasks.find((task) => task.id === "task_demo_indefinite")?.offerExpiresAt, null);
    assert.equal(tasks.find((task) => task.id === "task_demo_expired")?.offerExpiresAt, now);
    assert.equal(tasks.find((task) => task.id === "task_demo_expired")?.offerPending, false);
  });
  it("gives each consumer fresh fixture data", () => {
    const first = createTaskBoardFixtures();
    first.allStatusesResponse.tasks[0].title = "Changed locally";
    first.options.agents[0].name = "Changed locally";
    const second = createTaskBoardFixtures();
    assert.notEqual(second.allStatusesResponse.tasks[0].title, "Changed locally");
    assert.notEqual(second.options.agents[0].name, "Changed locally");
  });
  it("accepts empty and out-of-range result pages", () => {
    assert.ok(taskBoardResponseSchema.safeParse({ tasks: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }).success);
    assert.ok(taskBoardResponseSchema.safeParse({ tasks: [], pagination: { page: 8, pageSize: 20, total: 1, totalPages: 1 } }).success);
  });
  it("rejects invalid points, dates, statuses, oversized pages and missing fields", () => {
    const { allStatusesResponse: response } = createTaskBoardFixtures();
    const task = response.tasks[0];
    for (const changes of [{ points: -1 }, { points: 1.5 }, { status: "done" }, { createdAt: "yesterday" }, { goal: undefined }]) assert.equal(taskBoardTaskSchema.safeParse({ ...task, ...changes }).success, false);
    assert.equal(taskBoardResponseSchema.safeParse({ ...response, tasks: Array(21).fill(task) }).success, false);
    assert.equal(taskBoardResponseSchema.safeParse({ ...response, pagination: { ...response.pagination, pageSize: 100 } }).success, false);
  });
});
