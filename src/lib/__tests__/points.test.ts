import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  breakdownFor,
  buildScoreboard,
  canAwardReview,
  clampTaskPoints,
  getWeekRange,
  validateTaskType,
  type LedgerEntry,
  type PointReason,
  type PointRule,
  type WeekRange,
} from "@/lib/points";
import {
  awardForRule,
  awardPoints,
  getAgentPoints,
  getUserPoints,
  type PointsDb,
} from "@/lib/points-server";

// ── In-memory PointsDb (mirrors the ON CONFLICT semantics of the real one) ──

function inMemoryPointsDb(input: {
  users?: string[];
  agents?: Record<string, string>; // agentId -> ownerId
  rules?: PointRule[];
  rows?: LedgerEntry[];
}): PointsDb & { rows: LedgerEntry[] } {
  const users = new Set(input.users ?? []);
  const agents = new Map(Object.entries(input.agents ?? {}));
  const rules = [...(input.rules ?? [])];
  const rows = [...(input.rows ?? [])];
  const byKey = new Map(rows.map((row) => [row.idempotencyKey, row]));

  return {
    rows,
    async insertLedgerRow(row) {
      if (byKey.has(row.idempotencyKey)) return { inserted: false, row: null };
      byKey.set(row.idempotencyKey, row);
      rows.push(row);
      return { inserted: true, row };
    },
    async findLedgerByIdempotencyKey(key) {
      return byKey.get(key) ?? null;
    },
    async userExists(userId) {
      return users.has(userId);
    },
    async agentOwnerId(agentId) {
      return agents.get(agentId) ?? null;
    },
    async sumLedger({ userId, agentId, reason, range }) {
      return rows
        .filter(
          (row) =>
            (userId == null || row.userId === userId) &&
            (agentId == null || row.agentId === agentId) &&
            (reason == null || row.reason === reason) &&
            (range == null || (row.createdAt >= range.start && row.createdAt < range.end))
        )
        .reduce((total, row) => total + row.amount, 0);
    },
    async getRule(ruleKey) {
      return rules.find((rule) => rule.ruleKey === ruleKey) ?? null;
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
}): LedgerEntry {
  return {
    id: input.id,
    userId: input.userId,
    agentId: input.agentId ?? null,
    projectId: "project_zedu",
    amount: input.amount,
    reason: input.reason,
    sourceType: null,
    sourceId: null,
    idempotencyKey: input.idempotencyKey,
    grantedByUserId: null,
    note: null,
    createdAt: new Date(input.createdAt),
  };
}

const W0: WeekRange = { start: new Date("2026-10-18T23:00:00Z"), end: new Date("2026-10-25T23:00:00Z") };
const NOW = new Date("2026-10-20T09:00:00Z");

// ── Week math ────────────────────────────────────────────────────────────────

describe("getWeekRange (Africa/Lagos)", () => {
  it("starts weeks on Monday 00:00 Lagos and ends on the following Monday", () => {
    const range = getWeekRange(new Date("2026-10-20T09:00:00Z"));
    assert.equal(range.start.toISOString(), "2026-10-18T23:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-10-25T23:00:00.000Z");
  });

  it("puts Sunday 23:59 Lagos and Monday 00:00 Lagos in different weeks", () => {
    // Lagos = UTC+1: Sunday 23:59 → 22:59 UTC, Monday 00:00 → 23:00 UTC.
    const sunday = getWeekRange(new Date("2026-10-18T22:59:00Z"));
    const monday = getWeekRange(new Date("2026-10-18T23:00:00Z"));
    assert.equal(sunday.start.toISOString(), "2026-10-11T23:00:00.000Z");
    assert.equal(monday.start.toISOString(), "2026-10-18T23:00:00.000Z");
    assert.notEqual(sunday.start.toISOString(), monday.start.toISOString());
  });
});

// ── Task-type validation & amounts ───────────────────────────────────────────

describe("validateTaskType", () => {
  it("accepts valid points and max", () => {
    assert.deepEqual(validateTaskType({ points: 20, maxPoints: 50 }), []);
  });

  it("rejects max below points, negatives, and non-integers", () => {
    assert.ok(validateTaskType({ points: 60, maxPoints: 50 }).length > 0);
    assert.ok(validateTaskType({ points: -1, maxPoints: 50 }).length > 0);
    assert.ok(validateTaskType({ points: 20.5, maxPoints: 50 }).length > 0);
    assert.ok(validateTaskType({ points: 20, maxPoints: 10 }).length > 0);
  });
});

describe("clampTaskPoints", () => {
  it("clamps the task snapshot to the type's cap", () => {
    assert.equal(clampTaskPoints(40, 50), 40);
    assert.equal(clampTaskPoints(60, 50), 50);
    assert.equal(clampTaskPoints(-5, 50), 0);
  });
});

// ── awardPoints ──────────────────────────────────────────────────────────────

describe("awardPoints", () => {
  it("is idempotent: a duplicate key inserts one row and returns the existing entry", async () => {
    const db = inMemoryPointsDb({ users: ["u1"] });
    const meta = { sourceType: "task" as const, sourceId: "t1" };

    const first = await awardPoints("u1", 30, "task_approved", meta, { db });
    assert.equal(first.awarded, true);
    assert.equal(db.rows.length, 1);

    const second = await awardPoints("u1", 30, "task_approved", meta, { db });
    assert.equal(second.awarded, false);
    assert.equal(second.entryId, first.entryId);
    assert.equal(db.rows.length, 1);
  });

  it("keeps one row under concurrent duplicate calls", async () => {
    const db = inMemoryPointsDb({ users: ["u1"] });
    const meta = { sourceType: "task" as const, sourceId: "t1" };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => awardPoints("u1", 30, "task_approved", meta, { db }))
    );

    const awarded = results.filter((result) => result.awarded);
    assert.equal(awarded.length, 1);
    assert.equal(db.rows.length, 1);
    for (const result of results.filter((candidate) => !candidate.awarded)) {
      assert.equal(result.entryId, awarded[0].entryId);
    }
  });

  it("refuses non-zero-integer violations, unknown users, and unknown reasons", async () => {
    const db = inMemoryPointsDb({ users: ["u1"] });

    const zero = await awardPoints("u1", 0, "task_approved", undefined, { db });
    assert.equal(zero.awarded, false);

    const missingUser = await awardPoints("ghost", 10, "task_approved", undefined, { db });
    assert.equal(missingUser.awarded, false);

    const badReason = await awardPoints("u1", 10, "nope" as PointReason, undefined, { db });
    assert.equal(badReason.awarded, false);

    assert.equal(db.rows.length, 0);
  });

  it("blocks a review when the reviewer's owner is the worker's owner", async () => {
    const db = inMemoryPointsDb({ users: ["u1", "u2"], agents: { a1: "u1" } });
    const meta = { agentId: "a1", sourceType: "comment" as const, sourceId: "c1" };

    const blocked = await awardPoints("u1", 1, "review_submitted", meta, { db, workerOwnerId: "u1" });
    assert.equal(blocked.awarded, false);
    assert.equal(db.rows.length, 0);

    const allowed = await awardPoints("u1", 1, "review_submitted", meta, { db, workerOwnerId: "u2" });
    assert.equal(allowed.awarded, true);
    assert.equal(db.rows.length, 1);
  });
});

describe("canAwardReview", () => {
  it("allows cross-owner reviews only", () => {
    assert.equal(canAwardReview("u1", "u1"), false);
    assert.equal(canAwardReview("u1", "u2"), true);
    assert.equal(canAwardReview(null, "u1"), true);
    assert.equal(canAwardReview("u1", null), true);
  });
});

// ── awardForRule ─────────────────────────────────────────────────────────────

describe("awardForRule", () => {
  it("skips disabled rules", async () => {
    const db = inMemoryPointsDb({
      users: ["u1"],
      rules: [{ ruleKey: "idea_accepted", amount: 5, enabled: false, weeklyCap: null }],
    });
    const result = await awardForRule("idea_accepted", "u1", undefined, { db, now: NOW });
    assert.equal(result.awarded, false);
    assert.equal(db.rows.length, 0);
  });

  it("enforces the weekly cap", async () => {
    const db = inMemoryPointsDb({
      users: ["u1"],
      rules: [{ ruleKey: "review_submitted", amount: 1, enabled: true, weeklyCap: 3 }],
    });

    for (let i = 0; i < 3; i++) {
      const result = await awardForRule(
        "review_submitted",
        "u1",
        { sourceType: "comment", sourceId: `c${i}` },
        { db, now: NOW }
      );
      assert.equal(result.awarded, true);
    }
    assert.equal(db.rows.length, 3);

    const capped = await awardForRule(
      "review_submitted",
      "u1",
      { sourceType: "comment", sourceId: "c4" },
      { db, now: NOW }
    );
    assert.equal(capped.awarded, false);
    assert.equal(db.rows.length, 3);
  });
});

// ── Point lookups ────────────────────────────────────────────────────────────

describe("getUserPoints / getAgentPoints", () => {
  it("sums ledger rows for a user or agent, respecting the range", async () => {
    const db = inMemoryPointsDb({
      users: ["u1"],
      rows: [
        entry({ id: "e1", userId: "u1", agentId: "a1", amount: 10, reason: "task_approved", idempotencyKey: "k1", createdAt: "2026-10-19T10:00:00Z" }),
        entry({ id: "e2", userId: "u1", agentId: "a1", amount: 5, reason: "task_approved", idempotencyKey: "k2", createdAt: "2026-10-20T10:00:00Z" }),
        entry({ id: "e3", userId: "u1", agentId: "a2", amount: 7, reason: "task_approved", idempotencyKey: "k3", createdAt: "2026-10-19T11:00:00Z" }),
        entry({ id: "e4", userId: "u1", agentId: "a1", amount: 99, reason: "task_approved", idempotencyKey: "k4", createdAt: "2026-09-01T10:00:00Z" }),
      ],
    });

    assert.equal(await getUserPoints("u1", W0, { db }), 22);
    assert.equal(await getUserPoints("u1", undefined, { db }), 121);
    assert.equal(await getAgentPoints("a1", W0, { db }), 15);
    assert.equal(await getAgentPoints("a2", W0, { db }), 7);
  });
});

// ── Aggregation & scoreboard ─────────────────────────────────────────────────

describe("breakdownFor", () => {
  it("splits points into tasks, reviews, ideas and adjustments", () => {
    const entries = [
      entry({ id: "e1", userId: "u1", amount: 100, reason: "task_approved", idempotencyKey: "k1", createdAt: "2026-10-19T10:00:00Z" }),
      entry({ id: "e2", userId: "u1", amount: 1, reason: "review_submitted", idempotencyKey: "k2", createdAt: "2026-10-19T10:00:00Z" }),
      entry({ id: "e3", userId: "u1", amount: 5, reason: "idea_accepted", idempotencyKey: "k3", createdAt: "2026-10-19T10:00:00Z" }),
      entry({ id: "e4", userId: "u1", amount: -10, reason: "manual_adjustment", idempotencyKey: "k4", createdAt: "2026-10-19T10:00:00Z" }),
      entry({ id: "e5", userId: "u1", amount: 99, reason: "task_approved", idempotencyKey: "k5", createdAt: "2026-09-01T10:00:00Z" }),
    ];
    assert.deepEqual(breakdownFor(entries, W0, "u1"), { tasks: 100, reviews: 1, ideas: 5, adjustments: -10 });
  });
});

describe("buildScoreboard", () => {
  it("includes zero-point users and orders ties deterministically (dense rank)", () => {
    const entries = [
      entry({ id: "e1", userId: "u_beta", amount: 20, reason: "task_approved", idempotencyKey: "k1", createdAt: "2026-10-19T10:00:00Z" }),
      entry({ id: "e2", userId: "u_alpha", amount: 20, reason: "task_approved", idempotencyKey: "k2", createdAt: "2026-10-19T10:00:00Z" }),
    ];
    const users = [
      { id: "u_alpha", name: "Alpha" },
      { id: "u_beta", name: "Beta" },
      { id: "u_zero", name: "Zero" },
    ];
    const result = buildScoreboard({ entries, users, agents: [], range: W0, taskTypes: [] });
    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[0].name, "Alpha");
    assert.equal(result.rows[1].name, "Beta");
    assert.equal(result.rows[2].name, "Zero");
    assert.equal(result.rows[0].rank, 1);
    assert.equal(result.rows[1].rank, 1);
    assert.equal(result.rows[2].rank, 2);
    assert.equal(result.rows[2].points, 0);
  });

  it("renders progress bars sensibly at 0, 499, 500 and 620", () => {
    const make = (points: number, name: string) =>
      entry({ id: `p_${name}`, userId: `u_${name}`, amount: points, reason: "task_approved", idempotencyKey: `p_${name}`, createdAt: "2026-10-19T10:00:00Z" });

    const result = buildScoreboard({
      entries: [make(0, "zero"), make(499, "near"), make(500, "at"), make(620, "over")].filter((e) => e.amount > 0),
      users: [
        { id: "u_zero", name: "Zero" },
        { id: "u_near", name: "Near" },
        { id: "u_at", name: "At" },
        { id: "u_over", name: "Over" },
      ],
      agents: [],
      range: W0,
      taskTypes: [],
    });

    const row = (userId: string) => result.rows.find((candidate) => candidate.userId === userId)!;
    assert.deepEqual([row("u_zero").progressPct, row("u_zero").actualPct], [0, 0]);
    assert.deepEqual([row("u_near").progressPct, row("u_near").actualPct], [99, 100]);
    assert.deepEqual([row("u_at").progressPct, row("u_at").actualPct], [100, 100]);
    assert.deepEqual([row("u_over").progressPct, row("u_over").actualPct], [100, 124]);
  });
});
