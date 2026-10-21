/**
 * Scoreboard data layer — server only.
 *
 * Builds the scoreboard, the bids-panel fairness stats, the project points
 * rules and the user's points history against the schema requested from unit 0
 * (`doc/points-schema-TEMP.sql`). Like `points-server`, the shared Prisma
 * client is imported only by the caller (routes); tests inject an in-memory
 * store.
 *
 * "Tasks given" is accepted offers this week: a task whose offer was made within
 * the range and whose status has since left bidding (i.e. it was accepted),
 * attributed to the assigned agent. The underlying columns belong to unit 3's
 * agent-task model — the goals foundation reuses the `"Task"` table with
 * `"assignedAgentId"`, `"offeredAt"` and the `TaskStatus` enum. Unit 3 has no
 * accepted-at timestamp yet, so `"offeredAt"` is the proxy (see the contract
 * doc); the query here matches those real column names.
 */
import { Prisma } from "@prisma/client";
import {
  ACTIVE_TASK_LIMIT,
  DEFAULT_POINT_RULES,
  WEEKLY_TARGET,
  buildScoreboard,
  getBidderFairness as computeBidderFairness,
  getWeekRange,
  type BidderFairness,
  type Breakdown,
  type LedgerEntry,
  type PointRule,
  type ScoreboardAgent,
  type ScoreboardUser,
  type TaskTypeConfig,
  type WeekRange,
} from "./points";
import type { PointsSqlClient } from "./points-server";
import { prismaTaskTypesStore } from "./task-types-server";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Store ────────────────────────────────────────────────────────────────────

export type LedgerPage = { entries: LedgerEntry[]; total: number };

export interface ScoreboardStore {
  listLedger(range: WeekRange): Promise<LedgerEntry[]>;
  listUsers(): Promise<ScoreboardUser[]>;
  listAgents(): Promise<ScoreboardAgent[]>;
  listTaskTypes(): Promise<TaskTypeConfig[]>;
  listRules(): Promise<PointRule[]>;
  /** Accepted offers this week, keyed by assigned agent id (see module note). */
  tasksGivenThisWeek(range: WeekRange): Promise<Record<string, number>>;
  /** Currently active tasks per agent (in_progress → in_review). */
  activeTasks(): Promise<Record<string, number>>;
  /** One user's ledger, newest first, paginated. */
  listLedgerByUser(userId: string, page: { offset: number; limit: number }): Promise<LedgerPage>;
  /** All-time balance for a user. */
  sumLedgerForUser(userId: string): Promise<number>;
}

type RawLedgerRow = {
  id: string;
  user_id: string;
  agent_id: string | null;
  project_id: string;
  amount: number;
  reason: string;
  source_type: string | null;
  source_id: string | null;
  idempotency_key: string;
  granted_by_user_id: string | null;
  note: string | null;
  created_at: Date;
};

const LEDGER_COLUMNS = Prisma.sql`id, user_id, agent_id, project_id, amount, reason, source_type, source_id, idempotency_key, granted_by_user_id, note, created_at`;

function toLedgerEntry(raw: RawLedgerRow): LedgerEntry {
  return {
    id: raw.id,
    userId: raw.user_id,
    agentId: raw.agent_id,
    projectId: raw.project_id,
    amount: raw.amount,
    reason: raw.reason as LedgerEntry["reason"],
    sourceType: (["task", "comment", "idea"] as const).includes(raw.source_type as "task")
      ? (raw.source_type as "task" | "comment" | "idea")
      : null,
    sourceId: raw.source_id,
    idempotencyKey: raw.idempotency_key,
    grantedByUserId: raw.granted_by_user_id,
    note: raw.note,
    createdAt: raw.created_at,
  };
}

/** Wraps a Prisma client (or transaction) with the scoreboard queries. */
export function prismaScoreboardStore(client: PointsSqlClient): ScoreboardStore {
  return {
    async listLedger(range) {
      const rows = await client.$queryRaw<RawLedgerRow[]>`
        SELECT ${LEDGER_COLUMNS} FROM points_ledger
        WHERE created_at >= ${range.start} AND created_at < ${range.end}
        ORDER BY created_at ASC`;
      return rows.map(toLedgerEntry);
    },

    async listUsers() {
      const rows = await client.$queryRaw<{ id: string; name: string | null }[]>`
        SELECT id, name FROM "User" ORDER BY name ASC`;
      return rows.map((row) => ({ id: row.id, name: row.name }));
    },

    async listAgents() {
      const rows = await client.$queryRaw<{ id: string; name: string; ownerId: string }[]>`
        SELECT id, name, "ownerId" FROM "Agent"`;
      return rows.map((row) => ({ id: row.id, name: row.name, ownerId: row.ownerId }));
    },

    async listTaskTypes() {
      const records = await prismaTaskTypesStore(client).list(true);
      return records.map(({ id, slug, name, description, points, maxPoints, isActive }) => ({
        id,
        slug,
        name,
        description,
        points,
        maxPoints,
        isActive,
      }));
    },

    async listRules() {
      const rows = await client.$queryRaw<{
        rule_key: string;
        amount: number;
        enabled: boolean;
        weekly_cap: number | null;
      }[]>`SELECT rule_key, amount, enabled, weekly_cap FROM point_rules`;
      return rows.map((row) => ({
        ruleKey: row.rule_key,
        amount: row.amount,
        enabled: row.enabled,
        weeklyCap: row.weekly_cap,
      }));
    },

    async tasksGivenThisWeek(range) {
      // Real unit-3 columns on the agent-task "Task" table (goals foundation).
      // Degrades to zero until unit 3's migration actually lands those columns.
      const columns = await client.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Task' AND column_name = 'assignedAgentId'
        ) AS exists`;
      if (!columns[0]?.exists) return {};

      const rows = await client.$queryRaw<{ assignedAgentId: string; count: number }[]>`
        SELECT "assignedAgentId", COUNT(*)::int AS count
        FROM "Task"
        WHERE "offeredAt" >= ${range.start} AND "offeredAt" < ${range.end}
          AND "assignedAgentId" IS NOT NULL
          AND status NOT IN ('proposed', 'open', 'bidding', 'reopened')
        GROUP BY "assignedAgentId"`;
      return Object.fromEntries(rows.map((row) => [row.assignedAgentId, row.count]));
    },

    async activeTasks() {
      const columns = await client.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Task' AND column_name = 'assignedAgentId'
        ) AS exists`;
      if (!columns[0]?.exists) return {};

      const rows = await client.$queryRaw<{ assignedAgentId: string; count: number }[]>`
        SELECT "assignedAgentId", COUNT(*)::int AS count
        FROM "Task"
        WHERE status IN ('in_progress', 'changes_requested', 'submitted', 'in_review')
          AND "assignedAgentId" IS NOT NULL
        GROUP BY "assignedAgentId"`;
      return Object.fromEntries(rows.map((row) => [row.assignedAgentId, row.count]));
    },

    async listLedgerByUser(userId, { offset, limit }) {
      const countRows = await client.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM points_ledger WHERE user_id = ${userId}`;
      const rows = await client.$queryRaw<RawLedgerRow[]>`
        SELECT ${LEDGER_COLUMNS} FROM points_ledger
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}`;
      return { entries: rows.map(toLedgerEntry), total: countRows[0]?.total ?? 0 };
    },

    async sumLedgerForUser(userId) {
      const rows = await client.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::int AS total FROM points_ledger WHERE user_id = ${userId}`;
      return rows[0]?.total ?? 0;
    },
  };
}

async function resolveStore(options?: { store?: ScoreboardStore; tx?: Prisma.TransactionClient }): Promise<ScoreboardStore> {
  if (options?.store) return options.store;
  if (options?.tx) return prismaScoreboardStore(options.tx);
  const { prisma } = await import("@/lib/prisma");
  return prismaScoreboardStore(prisma);
}

// ── Range ────────────────────────────────────────────────────────────────────

export type ScoreboardRangeSelection = "this_week" | "last_week" | "all_time";

export const SCOREBOARD_RANGES: ScoreboardRangeSelection[] = ["this_week", "last_week", "all_time"];

export function resolveScoreboardRange(
  selection: ScoreboardRangeSelection,
  options: { weekStart?: string | Date; now?: Date } = {}
): WeekRange {
  if (selection === "all_time") return { start: new Date(0), end: new Date(8640000000000000) };
  const now = options.now ?? new Date();
  if (options.weekStart) return getWeekRange(new Date(options.weekStart));
  if (selection === "last_week") return getWeekRange(new Date(now.getTime() - 7 * DAY_MS));
  return getWeekRange(now);
}

// ── Rules ────────────────────────────────────────────────────────────────────

export type ProjectPointsRules = {
  task_types: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    points: number;
    max_points: number;
  }[];
  review_points: number | null;
  idea_accepted: number | null;
  task_proposal_accepted: number | null;
  active_task_limit: number;
};

/** The `rules` block for the scoreboard, `GET /project` and the onboarding prompt. */
export function buildProjectPointsRules(
  taskTypes: TaskTypeConfig[],
  rules: PointRule[] = DEFAULT_POINT_RULES,
  activeTaskLimit = ACTIVE_TASK_LIMIT
): ProjectPointsRules {
  const enabledAmount = (ruleKey: string) => {
    const rule = rules.find((candidate) => candidate.ruleKey === ruleKey);
    return rule?.enabled ? rule.amount : null;
  };
  return {
    task_types: taskTypes
      .filter((type) => type.isActive)
      .map(({ id, slug, name, description, points, maxPoints }) => ({
        id,
        slug,
        name,
        description,
        points,
        max_points: maxPoints,
      })),
    review_points: enabledAmount("review_submitted"),
    idea_accepted: enabledAmount("idea_accepted"),
    task_proposal_accepted: enabledAmount("task_proposal_accepted"),
    active_task_limit: activeTaskLimit,
  };
}

/** The project's points rules for `/project` and onboarding (DB-backed). */
export async function getProjectPointsRules(options?: {
  store?: ScoreboardStore;
  tx?: Prisma.TransactionClient;
}): Promise<ProjectPointsRules> {
  const store = await resolveStore(options);
  const [taskTypes, rules] = await Promise.all([store.listTaskTypes(), store.listRules()]);
  return buildProjectPointsRules(taskTypes, rules);
}

// ── Scoreboard ───────────────────────────────────────────────────────────────

export type ScoreboardWireRow = {
  rank: number;
  user_id: string;
  name: string;
  points: number;
  progress_pct: number;
  actual_pct: number;
  breakdown: Breakdown;
  agents: { id: string; name: string; points: number }[];
  tasks_given_this_week: number;
};

export type ScoreboardResponse = {
  range: { start: string; end: string };
  target: number;
  rows: ScoreboardWireRow[];
  rules: ProjectPointsRules;
};

function serializeScoreboardRow(row: {
  rank: number;
  userId: string;
  name: string;
  points: number;
  progressPct: number;
  actualPct: number;
  breakdown: Breakdown;
  agents: { agentId: string; name: string; points: number }[];
  tasksGivenThisWeek: number;
}): ScoreboardWireRow {
  return {
    rank: row.rank,
    user_id: row.userId,
    name: row.name,
    points: row.points,
    progress_pct: row.progressPct,
    actual_pct: row.actualPct,
    breakdown: row.breakdown,
    agents: row.agents.map((agent) => ({ id: agent.agentId, name: agent.name, points: agent.points })),
    tasks_given_this_week: row.tasksGivenThisWeek,
  };
}

/**
 * The full scoreboard. Ledger rows are grouped per user over `[start, end)`;
 * users are LEFT JOINed so people with 0 points still appear, ranked by points
 * descending, then name for deterministic ties.
 */
export async function fetchScoreboard(options: {
  range?: ScoreboardRangeSelection;
  weekStart?: string | Date;
  now?: Date;
  store?: ScoreboardStore;
  tx?: Prisma.TransactionClient;
}): Promise<ScoreboardResponse> {
  const store = await resolveStore(options);
  const week = resolveScoreboardRange(options.range ?? "this_week", {
    weekStart: options.weekStart,
    now: options.now,
  });

  const [entries, users, agents, taskTypes, rules, tasksGivenByAgent] = await Promise.all([
    store.listLedger(week),
    store.listUsers(),
    store.listAgents(),
    store.listTaskTypes(),
    store.listRules(),
    store.tasksGivenThisWeek(week),
  ]);

  const tasksGivenByUser: Record<string, number> = {};
  for (const agent of agents) {
    const count = tasksGivenByAgent[agent.id] ?? 0;
    if (count > 0) tasksGivenByUser[agent.ownerId] = (tasksGivenByUser[agent.ownerId] ?? 0) + count;
  }

  const result = buildScoreboard({
    entries,
    users,
    agents,
    range: week,
    taskTypes,
    rules,
    activeTaskLimit: ACTIVE_TASK_LIMIT,
    tasksGivenThisWeek: tasksGivenByUser,
    target: WEEKLY_TARGET,
  });

  return {
    range: { start: week.start.toISOString(), end: week.end.toISOString() },
    target: result.target,
    rows: result.rows.map(serializeScoreboardRow),
    rules: buildProjectPointsRules(taskTypes, rules),
  };
}

// ── Bids-panel fairness ──────────────────────────────────────────────────────

export type BidderFairnessWire = {
  agent_id: string;
  agent_points_this_week: number;
  owner_points_this_week: number;
  tasks_given_this_week: number;
  active_tasks: number;
};

function serializeBidderFairness(row: BidderFairness): BidderFairnessWire {
  return {
    agent_id: row.agentId,
    agent_points_this_week: row.agentPointsThisWeek,
    owner_points_this_week: row.ownerPointsThisWeek,
    tasks_given_this_week: row.tasksGivenThisWeek,
    active_tasks: row.activeTasks,
  };
}

/** Fairness stats for the bids panel (DB-backed; this week). */
export async function getBidderFairness(
  agentIds: string[],
  options?: { store?: ScoreboardStore; tx?: Prisma.TransactionClient; now?: Date }
): Promise<BidderFairnessWire[]> {
  const store = await resolveStore(options);
  const week = getWeekRange(options?.now);

  const [entries, agents, tasksGivenThisWeek, activeTasks] = await Promise.all([
    store.listLedger(week),
    store.listAgents(),
    store.tasksGivenThisWeek(week),
    store.activeTasks(),
  ]);

  const rows = computeBidderFairness(agentIds, { entries, agents, range: week, tasksGivenThisWeek, activeTasks });
  return rows.map(serializeBidderFairness);
}

// ── My points history ────────────────────────────────────────────────────────

export type PointsHistoryWireEntry = {
  id: string;
  amount: number;
  reason: string;
  source_type: string | null;
  source_id: string | null;
  agent_id: string | null;
  granted_by_user_id: string | null;
  note: string | null;
  created_at: string;
};

export type PointsHistoryResponse = {
  entries: PointsHistoryWireEntry[];
  balance: number;
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

function serializeLedgerEntry(entry: LedgerEntry): PointsHistoryWireEntry {
  return {
    id: entry.id,
    amount: entry.amount,
    reason: entry.reason,
    source_type: entry.sourceType,
    source_id: entry.sourceId,
    agent_id: entry.agentId,
    granted_by_user_id: entry.grantedByUserId,
    note: entry.note,
    created_at: entry.createdAt.toISOString(),
  };
}

/** One user's ledger history, newest first, paginated, with their all-time balance. */
export async function fetchUserPointsHistory(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    store?: ScoreboardStore;
    tx?: Prisma.TransactionClient;
  }
): Promise<PointsHistoryResponse> {
  const store = await resolveStore(options);
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(options?.limit ?? 20)));
  const offset = (page - 1) * limit;

  const [{ entries, total }, balance] = await Promise.all([
    store.listLedgerByUser(userId, { offset, limit }),
    store.sumLedgerForUser(userId),
  ]);

  return {
    entries: entries.map(serializeLedgerEntry),
    balance,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
