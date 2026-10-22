import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import {
  buildTaskBoardWhere, listTaskBoard, listTaskBoardOptions, prismaTaskBoardStore,
  serializeTaskBoardTask, taskBoardIsOpen, taskBoardOfferPending,
} from "@/lib/task-board-query";
import type { TaskBoardRecord, TaskBoardStore, TaskBoardTypeRecord } from "@/lib/task-board-query";
import { taskBoardQuerySchema, taskBoardResponseSchema, taskBoardOptionsSchema } from "@/lib/schemas/task-board";

const now = new Date("2026-10-22T09:00:00.000Z");
const context = { projectId: "project_a", userId: "user_a" };
const project = { id: context.projectId, slug: "demo" };
const types: TaskBoardTypeRecord[] = [
  { slug: "seo", name: "SEO", points: 25, isActive: true },
  { slug: "free", name: "Free", points: 0, isActive: true },
  { slug: "archived", name: "Archived", points: 25, isActive: false },
];
const typeMap = new Map(types.map((type) => [type.slug, type]));
function record(patch: Partial<TaskBoardRecord> = {}): TaskBoardRecord {
  return {
    id: "task_a", projectId: "project_a", title: "Headings", description: "A description", status: "bidding",
    taskType: "seo", points: null, assignedAgentId: null, assignedAgent: null,
    offeredToAgentId: null, offerExpiresAt: null, createdAt: now, updatedAt: now,
    workstream: { id: "stream_a", title: "SEO work", status: "accepted", goal: { id: "goal_a", projectId: "project_a", title: "Visibility", status: "active" } },
    ...patch,
  };
}
function where(input: Record<string, unknown> = {}) {
  return buildTaskBoardWhere(context, taskBoardQuerySchema.parse(input), types, now);
}
function clauses(input: Prisma.TaskWhereInput): Prisma.TaskWhereInput[] {
  return Array.isArray(input.AND) ? input.AND : input.AND ? [input.AND] : [];
}
function harness(overrides: Partial<TaskBoardStore> = {}) {
  const calls: { where?: Prisma.TaskWhereInput; countWhere?: Prisma.TaskWhereInput; skip?: number; scopes: string[] } = { scopes: [] };
  const store: TaskBoardStore = {
    project: async (id) => { calls.scopes.push(id); return { slug: "demo" }; },
    goalExists: async (id) => { calls.scopes.push(id); return true; },
    agentExists: async (id) => { calls.scopes.push(id); return true; },
    types: async (id) => { calls.scopes.push(id); return types; },
    goals: async (id) => { calls.scopes.push(id); return []; },
    agents: async (id) => { calls.scopes.push(id); return []; },
    usedTypes: async (id) => { calls.scopes.push(id); return []; },
    tasks: async (input, skip) => { calls.where = input; calls.skip = skip; return [record()]; },
    count: async (input) => { calls.countWhere = input; return 1; },
    ...overrides,
  };
  return { store, calls };
}

describe("Board availability and serialization", () => {
  for (const status of ["open", "bidding", "reopened"] as const) {
    it(`recognizes ${status} as globally available`, () => assert.ok(taskBoardIsOpen(record({ status }), context.projectId, now)));
  }
  for (const status of ["proposed", "in_progress", "submitted", "in_review", "changes_requested", "approved"] as const) {
    it(`does not make ${status} available`, () => assert.equal(taskBoardIsOpen(record({ status }), context.projectId, now), false));
  }
  it("rejects assigned, missing/foreign/nonaccepted hierarchy and inactive goals", () => {
    const base = record();
    assert.ok(base.workstream);
    const stream = base.workstream;
    for (const task of [
      record({ assignedAgentId: "worker" }), record({ projectId: "foreign" }), record({ workstream: null }),
      record({ workstream: { ...stream, status: "proposed" } }),
      record({ workstream: { ...stream, status: "rejected" } }),
      record({ workstream: { ...stream, goal: { ...stream.goal, projectId: "foreign" } } }),
      record({ workstream: { ...stream, goal: { ...stream.goal, status: "archived" } } }),
      record({ workstream: { ...stream, goal: { ...stream.goal, status: "completed" } } }),
    ]) assert.equal(taskBoardIsOpen(task, context.projectId, now), false);
  });
  it("uses offered-agent presence and exact expiry without changing records", () => {
    for (const [expiry, pending] of [[null, true], [new Date(now.getTime() + 1), true], [now, false], [new Date(now.getTime() - 1), false]] as const) {
      const task = record({ offeredToAgentId: "offered", offerExpiresAt: expiry });
      const before = structuredClone(task);
      assert.equal(taskBoardOfferPending(task, now), pending);
      assert.equal(taskBoardIsOpen(task, context.projectId, now), !pending);
      assert.deepEqual(task, before);
    }
    assert.equal(taskBoardOfferPending(record({ offerExpiresAt: new Date(now.getTime() + 1) }), now), false);
  });
  it("preserves snapshots and zero; falls back only to active types", () => {
    for (const [patch, expected] of [
      [{ points: 0 }, 0], [{ points: 10 }, 10], [{ points: null }, 25],
      [{ taskType: "free" }, 0], [{ taskType: "archived" }, null],
      [{ taskType: "unknown" }, null], [{ taskType: null }, null],
    ] as [Partial<TaskBoardRecord>, number | null][]) {
      assert.equal(serializeTaskBoardTask(record(patch), project, typeMap, now).points, expected);
    }
  });
  it("keeps legacy task fields without invented hierarchy or links", () => {
    const task = serializeTaskBoardTask(record({ workstream: null, taskType: null, description: null }), project, typeMap, now);
    assert.equal(task.goal, null);
    assert.equal(task.workstream, null);
    assert.equal(task.detailsUrl, null);
    assert.equal(task.taskTypeLabel, "Not set");
    assert.equal(task.isOpenForBids, false);
    assert.equal(task.createdAt, now.toISOString());
  });
  it("returns minimal local agent fields and suppresses corrupt foreign joins", () => {
    const agent = { id: "agent_a", projectId: "project_a", name: "Worker", owner: { name: null } };
    const serialized = serializeTaskBoardTask(record({ assignedAgentId: agent.id, assignedAgent: agent }), project, typeMap, now);
    assert.deepEqual(serialized.assignedAgent, { id: agent.id, name: agent.name, ownerName: null });
    assert.equal(serialized.assignedAgentId, agent.id);
    const task = record({ assignedAgentId: "foreign_agent", assignedAgent: { ...agent, id: "foreign_agent", projectId: "foreign" } });
    assert.ok(task.workstream);
    task.workstream.goal.projectId = "foreign";
    const hidden = serializeTaskBoardTask(task, project, typeMap, now);
    assert.equal(hidden.assignedAgent, null);
    assert.equal(hidden.assignedAgentId, null);
    assert.equal(hidden.goal, null);
    assert.equal(hidden.workstream, null);
    assert.equal(hidden.detailsUrl, null);
    assert.equal(hidden.isOpenForBids, false);
  });
  it("uses known labels and URL-encodes route segments", () => {
    assert.equal(serializeTaskBoardTask(record(), project, typeMap, now).taskTypeLabel, "SEO");
    assert.equal(serializeTaskBoardTask(record({ taskType: "old_type" }), project, typeMap, now).taskTypeLabel, "old_type");
    assert.equal(serializeTaskBoardTask(record({ id: "task/a" }), project, typeMap, now).detailsUrl, "/p/demo/goals/goal_a/workstreams/stream_a/tasks/task%2Fa");
  });
});

describe("Database board predicates", () => {
  it("scopes availability to the project without personal-agent restrictions", () => {
    assert.deepEqual(where(), { projectId: "project_a", AND: [{
      status: { in: ["open", "bidding", "reopened"] }, assignedAgentId: null,
      workstream: { is: { status: "accepted", goal: { is: { projectId: "project_a", status: "active" } } } },
      OR: [{ offeredToAgentId: null }, { offerExpiresAt: { lte: now } }],
    }] });
    assert.deepEqual(where({ status: "all" }), { projectId: "project_a" });
  });
  it("keeps exact statuses, taskType and goal constraints independent", () => {
    assert.deepEqual(clauses(where({ status: "submitted", type: "seo", goal: "goal_a" })), [
      { status: "submitted" }, { taskType: "seo" },
      { workstream: { is: { goalId: "goal_a", goal: { is: { projectId: "project_a" } } } } },
    ]);
  });
  it("uses literal title OR description search with escaped wildcard characters", () => {
    assert.deepEqual(clauses(where({ status: "all", q: "100%_\\path" })), [{ OR: [
      { title: { contains: "100\\%\\_\\\\path", mode: "insensitive" } },
      { description: { contains: "100\\%\\_\\\\path", mode: "insensitive" } },
    ] }]);
  });
  it("filters workers by ownership/project, not bidders or creators", () => {
    assert.deepEqual(clauses(where({ status: "all", agent: "mine" })), [{ assignedAgent: { is: { projectId: "project_a", ownerId: "user_a" } } }]);
    assert.deepEqual(clauses(where({ status: "all", agent: "unassigned" })), [{ assignedAgentId: null }]);
    assert.deepEqual(clauses(where({ status: "all", agent: "agent_a" })), [{ assignedAgentId: "agent_a", assignedAgent: { is: { projectId: "project_a" } } }]);
  });
  it("applies inclusive stored/fallback ranges while excluding unknown and inactive fallback", () => {
    assert.deepEqual(clauses(where({ status: "all", minPoints: 25, maxPoints: 25 })), [{ OR: [
      { points: { not: null, gte: 25, lte: 25 } }, { points: null, taskType: { in: ["seo"] } },
    ] }]);
    assert.deepEqual(clauses(where({ status: "all", minPoints: 0, maxPoints: 0 })), [{ OR: [
      { points: { not: null, gte: 0, lte: 0 } }, { points: null, taskType: { in: ["free"] } },
    ] }]);
    assert.deepEqual(clauses(where({ status: "all", minPoints: 26 })), [{ OR: [
      { points: { not: null, gte: 26 } }, { points: null, taskType: { in: [] } },
    ] }]);
    assert.deepEqual(clauses(where({ status: "all", maxPoints: 0 })), [{ OR: [
      { points: { not: null, lte: 0 } }, { points: null, taskType: { in: ["free"] } },
    ] }]);
  });
});

describe("Board service and options", () => {
  it("counts filtered matches before paging and uses the identical predicate for rows", async () => {
    const { store, calls } = harness({ count: async (input) => { calls.countWhere = input; return 41; } });
    const result = await listTaskBoard(store, context, taskBoardQuerySchema.parse({ status: "all", page: 2, minPoints: 25 }), now);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.deepEqual(result.data.pagination, { page: 2, pageSize: 20, total: 41, totalPages: 3 });
    assert.strictEqual(calls.where, calls.countWhere);
    assert.equal(calls.skip, 20);
    assert.ok(taskBoardResponseSchema.safeParse(result.data).success);
    assert.ok(calls.scopes.every((scope) => scope === context.projectId));
  });
  it("returns zero matches or an out-of-range page without fetching a substitute page", async () => {
    for (const [page, total, totalPages] of [[1, 0, 0], [4, 21, 2]]) {
      const { store, calls } = harness({ count: async () => total });
      const result = await listTaskBoard(store, context, taskBoardQuerySchema.parse({ status: "all", page }), now);
      assert.equal(result.status, "ok");
      if (result.status !== "ok") continue;
      assert.deepEqual(result.data, { tasks: [], pagination: { page, pageSize: 20, total, totalPages } });
      assert.equal(calls.where, undefined);
    }
  });
  it("returns not-found for an inaccessible goal or agent before reading results", async () => {
    for (const [query, overrides] of [
      [{ goal: "foreign" }, { goalExists: async () => false }],
      [{ agent: "foreign" }, { agentExists: async () => false }],
      [{}, { project: async () => null }],
    ] as [Record<string, unknown>, Partial<TaskBoardStore>][]) {
      const { store, calls } = harness(overrides);
      assert.deepEqual(await listTaskBoard(store, context, taskBoardQuerySchema.parse(query), now), { status: "not_found" });
      assert.equal(calls.countWhere, undefined);
      assert.equal(calls.where, undefined);
    }
  });
  it("does not look up special worker selectors as agent IDs", async () => {
    const { store } = harness({ agentExists: async () => { throw new Error("Unexpected ID lookup"); } });
    for (const agent of ["mine", "unassigned"]) assert.equal((await listTaskBoard(store, context, taskBoardQuerySchema.parse({ agent }), now)).status, "ok");
  });
  it("keeps legacy records in all-statuses responses", async () => {
    const { store } = harness({ tasks: async () => [record({ workstream: null, points: null, taskType: null })] });
    const result = await listTaskBoard(store, context, taskBoardQuerySchema.parse({ status: "all" }), now);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.data.tasks.length, 1);
    assert.equal(result.data.tasks[0].detailsUrl, null);
  });
  it("returns complete historical/archived choices and multiple owned agents, independent of tasks", async () => {
    const { store, calls } = harness({
      usedTypes: async () => [{ taskType: "historical" }, { taskType: "historical" }, { taskType: "seo" }, { taskType: null }],
      goals: async () => [
        { id: "goal_z", title: "Z", status: "archived" },
        { id: "goal_b", title: "A", status: "completed" },
        { id: "goal_a", title: "A", status: "active" },
      ],
      agents: async () => [
        { id: "b", name: "Worker", ownerId: "user_a", owner: { name: "Me" } },
        { id: "a", name: "Worker", ownerId: "user_a", owner: { name: "Me" } },
        { id: "c", name: "Another", ownerId: "user_b", owner: { name: null } },
      ],
    });
    const result = await listTaskBoardOptions(store, context);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.ok(taskBoardOptionsSchema.safeParse(result.data).success);
    assert.deepEqual(result.data.types.find((type) => type.value === "historical"), { value: "historical", label: "historical", isActive: null });
    assert.equal(result.data.types.find((type) => type.value === "archived")?.isActive, false);
    assert.deepEqual(result.data.goals.map((goal) => goal.id), ["goal_a", "goal_b", "goal_z"]);
    assert.deepEqual(result.data.agents.map((agent) => [agent.id, agent.isMine]), [["c", false], ["a", true], ["b", true]]);
    assert.deepEqual(Object.keys(result.data.agents[0]).sort(), ["id", "isMine", "name", "ownerName"]);
    assert.equal(calls.countWhere, undefined);
    assert.equal(calls.where, undefined);
  });
  it("returns not-found options for a missing project", async () => {
    const { store } = harness({ project: async () => null });
    assert.deepEqual(await listTaskBoardOptions(store, context), { status: "not_found" });
  });
  it("lets database failures propagate instead of reporting empty successful results", async () => {
    const { store } = harness({ count: async () => { throw new Error("Database unavailable"); } });
    await assert.rejects(listTaskBoard(store, context, taskBoardQuerySchema.parse({}), now), /Database unavailable/);
  });
});

describe("Prisma adapter query shape (no database connection)", () => {
  it("scopes lookup/options reads and selects minimal joins with deterministic database pagination", async () => {
    const calls: { model: string; args: unknown }[] = [];
    const find = (model: string, value: unknown = []) => async (args: unknown) => { calls.push({ model, args }); return value; };
    // Deliberately narrow delegate double; this tests adapter arguments, not PostgreSQL execution.
    const client = {
      project: { findFirst: find("project", { slug: "demo" }) },
      goal: { findFirst: find("goal", { id: "goal_a" }), findMany: find("goals") },
      agent: { findFirst: find("agent", { id: "agent_a" }), findMany: find("agents") },
      taskTypeDef: { findMany: find("types") },
      task: { findMany: find("tasks"), count: find("count", 0) },
    } as unknown as Prisma.TransactionClient;
    const store = prismaTaskBoardStore(client);
    await store.project("project_a");
    await store.goalExists("project_a", "goal_a");
    await store.agentExists("project_a", "agent_a");
    await store.types("project_a");
    await store.goals("project_a");
    await store.agents("project_a");
    await store.usedTypes("project_a");
    const predicate = where({ status: "all" });
    await store.tasks(predicate, 20);
    await store.count(predicate);
    assert.deepEqual(calls[1].args, { where: { id: "goal_a", projectId: "project_a" }, select: { id: true } });
    assert.deepEqual(calls[2].args, { where: { id: "agent_a", projectId: "project_a" }, select: { id: true } });
    for (const index of [3, 4, 5, 6, 7, 8]) {
      const args = calls[index].args as { where: { projectId: string } };
      assert.equal(args.where.projectId, "project_a");
    }
    const page = calls[7].args as { take: number; skip: number; orderBy: unknown; select: unknown };
    assert.equal(page.take, 20);
    assert.equal(page.skip, 20);
    assert.deepEqual(page.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.equal(JSON.stringify(page.select).includes("keyHash"), false);
    assert.equal(JSON.stringify(page.select).includes("email"), false);
  });
});
