import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOpenApiDocument } from "@/lib/openapi";
import {
  buildProjectPointsRules,
  fetchScoreboard,
  fetchUserPointsHistory,
  getBidderFairness,
  resolveScoreboardRange,
  type ScoreboardStore,
  type SourceTask,
} from "@/lib/scoreboard-server";
import type { LedgerEntry, PointReason, PointRule, ScoreboardAgent, ScoreboardUser, TaskTypeConfig, WeekRange } from "@/lib/points";

// ── In-memory ScoreboardStore ────────────────────────────────────────────────

function inMemoryScoreboardStore(seed: {
  users?: ScoreboardUser[];
  agents?: ScoreboardAgent[];
  taskTypes?: TaskTypeConfig[];
  rules?: PointRule[];
  entries?: LedgerEntry[];
  tasksGiven?: Record<string, number>;
  active?: Record<string, number>;
  sourceTasks?: Record<string, SourceTask>;
} = {}): ScoreboardStore {
  const users = [...(seed.users ?? [])];
  const agents = [...(seed.agents ?? [])];
  const taskTypes = [...(seed.taskTypes ?? [])];
  const rules = [...(seed.rules ?? [])];
  const entries = [...(seed.entries ?? [])];
  const tasksGiven = { ...(seed.tasksGiven ?? {}) };
  const active = { ...(seed.active ?? {}) };

  const inRange = (entry: LedgerEntry, range: WeekRange) =>
    entry.createdAt >= range.start && entry.createdAt < range.end;

  return {
    async listLedger(range) {
      return entries.filter((entry) => inRange(entry, range)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async listUsers() {
      return users;
    },
    async listAgents() {
      return agents;
    },
    async listTaskTypes() {
      return taskTypes;
    },
    async listRules() {
      return rules;
    },
    async tasksGivenThisWeek() {
      return tasksGiven;
    },
    async activeTasks() {
      return active;
    },
    async listLedgerByUser(userId, { offset, limit }) {
      const own = entries
        .filter((entry) => entry.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { entries: own.slice(offset, offset + limit), total: own.length };
    },
    async sumLedgerForUser(userId) {
      return entries.filter((entry) => entry.userId === userId).reduce((total, entry) => total + entry.amount, 0);
    },
    async taskForSources(sources) {
      const known = seed.sourceTasks ?? {};
      const keys = sources.map((s) => `${s.sourceType}:${s.sourceId}`).filter((key) => key in known);
      return Object.fromEntries(keys.map((key) => [key, known[key]]));
    },
  };
}

function entry(input: {
  id: string;
  userId: string;
  amount: number;
  reason: PointReason;
  idempotencyKey: string;
  createdAt: string;
  agentId?: string;
  sourceType?: LedgerEntry["sourceType"];
  sourceId?: string;
}): LedgerEntry {
  return {
    id: input.id,
    userId: input.userId,
    agentId: input.agentId ?? null,
    projectId: "project_zedu",
    amount: input.amount,
    reason: input.reason,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    idempotencyKey: input.idempotencyKey,
    grantedByUserId: null,
    note: null,
    createdAt: new Date(input.createdAt),
  };
}

const NOW = new Date("2026-10-20T09:00:00Z");

const USERS: ScoreboardUser[] = [
  { id: "u_alpha", name: "Alpha" },
  { id: "u_beta", name: "Beta" },
  { id: "u_over", name: "Over" },
  { id: "u_zero", name: "Zero" },
];

const AGENTS: ScoreboardAgent[] = [
  { id: "a1", name: "Agent One", ownerId: "u_alpha" },
  { id: "a2", name: "Agent Two", ownerId: "u_beta" },
  { id: "a3", name: "Metro", ownerId: "u_over" },
];

const TASK_TYPES: TaskTypeConfig[] = [
  { id: "tt_content", slug: "content", name: "Content", description: "Articles", points: 40, maxPoints: 50, isActive: true },
  { id: "tt_data", slug: "data_entry", name: "Data entry", description: null, points: 5, maxPoints: 10, isActive: false },
];

const RULES: PointRule[] = [
  { ruleKey: "review_submitted", amount: 1, enabled: true, weeklyCap: null },
  { ruleKey: "idea_accepted", amount: 5, enabled: false, weeklyCap: null },
  { ruleKey: "task_proposal_accepted", amount: 5, enabled: false, weeklyCap: null },
];

// This week (W0): Alpha 96 (100 + 1 + 5 − 10), Beta 96, Over 620. Last week: Alpha 200.
const ENTRIES: LedgerEntry[] = [
  entry({ id: "e_a_task", userId: "u_alpha", agentId: "a1", amount: 100, reason: "task_approved", idempotencyKey: "k1", createdAt: "2026-10-19T10:00:00Z" }),
  entry({ id: "e_a_idea", userId: "u_alpha", amount: 5, reason: "idea_accepted", idempotencyKey: "k2", createdAt: "2026-10-19T11:00:00Z" }),
  entry({ id: "e_a_review", userId: "u_alpha", agentId: "a1", amount: 1, reason: "review_submitted", idempotencyKey: "k3", createdAt: "2026-10-19T12:00:00Z" }),
  entry({ id: "e_a_adj", userId: "u_alpha", amount: -10, reason: "manual_adjustment", idempotencyKey: "k4", createdAt: "2026-10-20T09:00:00Z" }),
  entry({ id: "e_a_prev", userId: "u_alpha", agentId: "a1", amount: 200, reason: "task_approved", idempotencyKey: "k5", createdAt: "2026-10-15T10:00:00Z" }),
  entry({ id: "e_b_task", userId: "u_beta", agentId: "a2", amount: 96, reason: "task_approved", idempotencyKey: "k6", createdAt: "2026-10-19T10:00:00Z" }),
  entry({ id: "e_o_task", userId: "u_over", agentId: "a3", amount: 620, reason: "task_approved", idempotencyKey: "k7", createdAt: "2026-10-19T10:00:00Z" }),
];

function store() {
  return inMemoryScoreboardStore({
    users: USERS,
    agents: AGENTS,
    taskTypes: TASK_TYPES,
    rules: RULES,
    entries: ENTRIES,
    tasksGiven: { a1: 2, a2: 1 },
    active: { a1: 1, a3: 2 },
  });
}

// ── fetchScoreboard ──────────────────────────────────────────────────────────

describe("fetchScoreboard", () => {
  it("includes zero-point users and caps progress at 100 while showing the true pct", async () => {
    const result = await fetchScoreboard({ projectId: "p1", store: store(), range: "this_week", now: NOW });
    const zero = result.rows.find((row) => row.user_id === "u_zero");
    assert.ok(zero, "zero-point user appears");
    assert.equal(zero.points, 0);

    const over = result.rows.find((row) => row.user_id === "u_over");
    assert.equal(over?.progress_pct, 100);
    assert.equal(over?.actual_pct, 124);
  });

  it("ranks by points desc, then name, with deterministic ties", async () => {
    const result = await fetchScoreboard({ projectId: "p1", store: store(), range: "this_week", now: NOW });
    assert.equal(result.rows[0].user_id, "u_over");
    assert.equal(result.rows[0].rank, 1);
    assert.equal(result.rows[1].user_id, "u_alpha");
    assert.equal(result.rows[2].user_id, "u_beta");
    assert.equal(result.rows[1].rank, 2);
    assert.equal(result.rows[2].rank, 2);
    assert.equal(result.rows[3].user_id, "u_zero");
    assert.equal(result.rows[3].rank, 3);
  });

  it("switches ranges: this_week vs last_week vs all_time", async () => {
    const thisWeek = await fetchScoreboard({ projectId: "p1", store: store(), range: "this_week", now: NOW });
    const lastWeek = await fetchScoreboard({ projectId: "p1", store: store(), range: "last_week", now: NOW });
    const allTime = await fetchScoreboard({ projectId: "p1", store: store(), range: "all_time", now: NOW });

    const points = (result: Awaited<ReturnType<typeof fetchScoreboard>>, userId: string) =>
      result.rows.find((row) => row.user_id === userId)?.points ?? 0;

    assert.equal(points(thisWeek, "u_alpha"), 96);
    assert.equal(points(lastWeek, "u_alpha"), 200);
    assert.equal(points(allTime, "u_alpha"), 296);
    assert.equal(points(thisWeek, "u_beta"), 96);
    assert.equal(points(lastWeek, "u_beta"), 0);
  });

  it("makes every row's breakdown sum equal its points", async () => {
    const result = await fetchScoreboard({ projectId: "p1", store: store(), range: "all_time", now: NOW });
    for (const row of result.rows) {
      const { tasks, reviews, ideas, adjustments } = row.breakdown;
      assert.equal(tasks + reviews + ideas + adjustments, row.points, `${row.name} breakdown sums to points`);
    }
  });

  it("builds the rules block with enabled amounts only", () => {
    const rules = buildProjectPointsRules(TASK_TYPES, RULES);
    assert.equal(rules.review_points, 1);
    assert.equal(rules.task_proposal_accepted, null);
    assert.equal(rules.active_task_limit, 2);
    assert.deepEqual(
      rules.task_types.map((type) => type.slug),
      ["content"]
    );
    assert.equal(rules.task_types[0].max_points, 50);
  });

  it("serializes agent attribution and tasks given per owner", async () => {
    const result = await fetchScoreboard({ projectId: "p1", store: store(), range: "this_week", now: NOW });
    const alpha = result.rows.find((row) => row.user_id === "u_alpha");
    assert.equal(alpha?.tasks_given_this_week, 2);
    assert.deepEqual(alpha?.agents, [{ id: "a1", name: "Agent One", points: 101 }]);
  });
});

// ── resolveScoreboardRange ───────────────────────────────────────────────────

describe("resolveScoreboardRange", () => {
  it("honors week_start and all_time", () => {
    const byStart = resolveScoreboardRange("this_week", { weekStart: "2026-10-05", now: NOW });
    assert.equal(byStart.start.toISOString(), "2026-10-04T23:00:00.000Z");

    const all = resolveScoreboardRange("all_time", { now: NOW });
    assert.equal(all.start.getTime(), 0);

    const last = resolveScoreboardRange("last_week", { now: NOW });
    assert.equal(last.start.toISOString(), "2026-10-11T23:00:00.000Z");
  });
});

// ── getBidderFairness ────────────────────────────────────────────────────────

describe("getBidderFairness", () => {
  it("returns agent and owner points, tasks given and active tasks", async () => {
    const rows = await getBidderFairness(["a1"], { projectId: "p1", store: store(), now: NOW });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      agent_id: "a1",
      agent_points_this_week: 101, // 100 + 1
      owner_points_this_week: 96, // Alpha's week total incl. adjustment
      tasks_given_this_week: 2,
      active_tasks: 1,
    });
  });
});

// ── fetchUserPointsHistory ───────────────────────────────────────────────────

describe("fetchUserPointsHistory", () => {
  it("paginates newest first and reports the all-time balance", async () => {
    const page1 = await fetchUserPointsHistory("u_alpha", { projectId: "p1", store: store(), page: 1, limit: 2 });
    assert.equal(page1.pagination.total, 5);
    assert.equal(page1.pagination.total_pages, 3);
    assert.equal(page1.entries.length, 2);
    assert.equal(page1.entries[0].id, "e_a_adj");
    assert.equal(page1.entries[1].id, "e_a_review");
    assert.equal(page1.balance, 296);

    const page2 = await fetchUserPointsHistory("u_alpha", { projectId: "p1", store: store(), page: 2, limit: 2 });
    assert.deepEqual(
      page2.entries.map((e) => e.id),
      ["e_a_idea", "e_a_task"]
    );
  });

  it("names the task behind a task, vote or comment source instead of leaving a bare id", async () => {
    const withSources = inMemoryScoreboardStore({
      entries: [
        entry({ id: "h_task", userId: "u_alpha", amount: 200, reason: "task_approved", idempotencyKey: "h1", createdAt: "2026-10-19T10:00:00Z", sourceType: "task", sourceId: "task_1" }),
        entry({ id: "h_vote", userId: "u_alpha", amount: 40, reason: "task_voted", idempotencyKey: "h2", createdAt: "2026-10-19T09:00:00Z", sourceType: "vote", sourceId: "vote_1" }),
        entry({ id: "h_review", userId: "u_alpha", amount: 1, reason: "review_submitted", idempotencyKey: "h3", createdAt: "2026-10-19T08:00:00Z", sourceType: "comment", sourceId: "comment_1" }),
      ],
      sourceTasks: {
        "task:task_1": { taskId: "task_1", number: 442, title: "Verify robots.txt" },
        "vote:vote_1": { taskId: "task_2", number: 1884, title: "Make Offer prices numeric" },
        "comment:comment_1": { taskId: "task_1", number: 442, title: "Verify robots.txt" },
      },
    });
    const { entries } = await fetchUserPointsHistory("u_alpha", { projectId: "p1", store: withSources });
    assert.deepEqual(entries.map((e) => e.source_task), [
      { id: "task_1", number: 442, title: "Verify robots.txt" },
      { id: "task_2", number: 1884, title: "Make Offer prices numeric" },
      { id: "task_1", number: 442, title: "Verify robots.txt" },
    ]);
  });

  it("leaves source_task null for a deleted source, an idea and an entry with no source", async () => {
    const withGaps = inMemoryScoreboardStore({
      entries: [
        entry({ id: "g_gone", userId: "u_alpha", amount: 40, reason: "task_voted", idempotencyKey: "g1", createdAt: "2026-10-19T12:00:00Z", sourceType: "vote", sourceId: "deleted_vote" }),
        entry({ id: "g_idea", userId: "u_alpha", amount: 5, reason: "idea_accepted", idempotencyKey: "g2", createdAt: "2026-10-19T11:00:00Z", sourceType: "idea", sourceId: "idea_1" }),
        entry({ id: "g_adj", userId: "u_alpha", amount: -10, reason: "manual_adjustment", idempotencyKey: "g3", createdAt: "2026-10-19T10:00:00Z" }),
      ],
    });
    const { entries } = await fetchUserPointsHistory("u_alpha", { projectId: "p1", store: withGaps });
    assert.deepEqual(entries.map((e) => e.source_task), [null, null, null]);
    assert.equal(entries[0].source_id, "deleted_vote");
  });
});

// ── OpenAPI ──────────────────────────────────────────────────────────────────

describe("scoreboard OpenAPI registration", () => {
  it("registers the scoreboard, bidders and me/points paths", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/scoreboard"]?.get);
    assert.ok(doc.paths["/api/scoreboard/bidders"]?.get);
    assert.ok(doc.paths["/api/me/points"]?.get);
  });
});
