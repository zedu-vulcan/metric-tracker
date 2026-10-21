/**
 * Points & scoreboard domain logic for the Zedu agent platform.
 *
 * Pure, database-free logic shared by the screens and the server contracts.
 * The database-backed implementations (`awardPoints`, `awardForRule`,
 * `getUserPoints`, `getAgentPoints`) live in `./points-server` and wrap this
 * module, so client bundles never import Prisma.
 *
 * Contract notes for the eventual backend:
 *  - Balance is never stored; it is `SUM(points_ledger.amount)`.
 *  - Every award is idempotent on `idempotency_key` (`ON CONFLICT DO NOTHING`).
 *  - Weeks run Monday 00:00 → Sunday 23:59 in Africa/Lagos, stored as UTC.
 */

export const POINTS_TIMEZONE = "Africa/Lagos";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const WEEKLY_TARGET = 500;
/** Fairness limit: how many tasks an agent may hold at once. */
export const ACTIVE_TASK_LIMIT = 2;
/** The single Zedu project. Used as `points_ledger.project_id`. */
export const DEFAULT_PROJECT_ID = "project_zedu";

// ── Reasons ──────────────────────────────────────────────────────────────────

export const POINT_REASONS = [
  "task_approved",
  "review_submitted",
  "idea_accepted",
  "task_proposal_accepted",
  "manual_adjustment",
  "reversal",
] as const;

export type PointReason = (typeof POINT_REASONS)[number];

export const REASON_LABELS: Record<PointReason, string> = {
  task_approved: "Task approved",
  review_submitted: "Review submitted",
  idea_accepted: "Idea accepted",
  task_proposal_accepted: "Task proposal accepted",
  manual_adjustment: "Manual adjustment",
  reversal: "Reversal",
};

export function isPointReason(value: string): value is PointReason {
  return (POINT_REASONS as readonly string[]).includes(value);
}

// ── Week math ────────────────────────────────────────────────────────────────

export type WeekRange = { start: Date; end: Date };

/** Wall-clock offset of `timezone` (from UTC) at `date`, in milliseconds. */
function timezoneOffsetMs(timezone: string, date: Date): number {
  const asUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const asLocal = Date.UTC(values.year, values.month - 1, values.day, values.hour % 24, values.minute, values.second);
  return asLocal - asUTC;
}

/** Monday 00:00 → next Monday 00:00, expressed as UTC instants. Defaults to Africa/Lagos. */
export function getWeekRange(date: Date = new Date(), timezone: string = POINTS_TIMEZONE): WeekRange {
  const offset = timezoneOffsetMs(timezone, date);
  const local = date.getTime() + offset;
  const day = new Date(local).getUTCDay(); // 0 Sun … 6 Sat
  const monday = new Date(local);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
  const start = new Date(monday.getTime() - offset);
  return { start, end: new Date(start.getTime() + WEEK_MS) };
}

/** Whole days left before the range ends (used for the "days left" KPI). */
export function daysLeftInWeek(range: WeekRange, now: Date = new Date()): number {
  return Math.max(0, Math.floor((range.end.getTime() - now.getTime()) / DAY_MS));
}

// ── Rules ────────────────────────────────────────────────────────────────────

export type PointRule = {
  ruleKey: string;
  amount: number;
  enabled: boolean;
  weeklyCap: number | null;
};

/** Seeded `point_rules` defaults. `weekly_target` is a target, not an award rule. */
export const DEFAULT_POINT_RULES: PointRule[] = [
  { ruleKey: "review_submitted", amount: 1, enabled: true, weeklyCap: null },
  { ruleKey: "idea_accepted", amount: 5, enabled: false, weeklyCap: null },
  { ruleKey: "task_proposal_accepted", amount: 5, enabled: false, weeklyCap: null },
];

// ── Task types ───────────────────────────────────────────────────────────────

export type TaskTypeConfig = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  points: number;
  maxPoints: number;
  isActive: boolean;
};

/** Validation for admin task-type create/edit. Returns a list of error messages (empty = valid). */
export function validateTaskType(input: { points: number; maxPoints: number }): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.points) || input.points < 0) {
    errors.push("Points must be a whole number of 0 or more.");
  }
  if (!Number.isInteger(input.maxPoints) || input.maxPoints < 0) {
    errors.push("Max points must be a whole number of 0 or more.");
  }
  if (
    Number.isInteger(input.points) &&
    Number.isInteger(input.maxPoints) &&
    input.maxPoints < input.points
  ) {
    errors.push("Max points must be at least the default points.");
  }
  return errors;
}

/** A task pays its snapshot, clamped to the type's cap. Snapshot is fixed at "open" time. */
export function clampTaskPoints(pointsSnapshot: number, maxPoints: number): number {
  if (!Number.isInteger(pointsSnapshot) || !Number.isInteger(maxPoints)) return 0;
  return Math.max(0, Math.min(pointsSnapshot, maxPoints));
}

// ── Ledger (pure shapes & helpers) ───────────────────────────────────────────

export type LedgerEntry = {
  id: string;
  userId: string;
  agentId: string | null;
  projectId: string;
  amount: number; // non-zero; negative for reversals/adjustments
  reason: PointReason;
  sourceType: "task" | "comment" | "idea" | null;
  sourceId: string | null;
  idempotencyKey: string;
  grantedByUserId: string | null;
  note: string | null;
  createdAt: Date;
};

/** Default key `${reason}:${sourceType}:${sourceId}`; callers without a source pass their own key. */
export function idempotencyKeyFor(
  reason: PointReason,
  sourceType?: string,
  sourceId?: string
): string {
  return `${reason}:${sourceType ?? ""}:${sourceId ?? ""}`;
}

/** A review earns points only when the reviewer's owner differs from the worker's owner. */
export function canAwardReview(reviewerOwnerId: string | null, workerOwnerId: string | null): boolean {
  return !(reviewerOwnerId && workerOwnerId && reviewerOwnerId === workerOwnerId);
}

// ── Aggregation & scoreboard ─────────────────────────────────────────────────

export type ScoreboardUser = { id: string; name: string | null };
export type ScoreboardAgent = { id: string; name: string; ownerId: string };

export type Breakdown = { tasks: number; reviews: number; ideas: number; adjustments: number };

export type ScoreboardRow = {
  rank: number;
  userId: string;
  name: string;
  points: number;
  progressPct: number; // capped at 100 for the bar
  actualPct: number; // true percentage, may exceed 100
  breakdown: Breakdown;
  agents: { agentId: string; name: string; points: number }[];
  tasksGivenThisWeek: number;
  isCurrentUser: boolean;
};

export type RulesBlock = {
  taskTypes: Omit<TaskTypeConfig, "isActive">[];
  reviewPoints: number | null;
  ideaAccepted: number | null;
  taskProposalAccepted: number | null;
  activeTaskLimit: number;
};

export type ScoreboardResult = {
  range: WeekRange;
  target: number;
  rows: ScoreboardRow[];
  rules: RulesBlock;
};

function inRange(createdAt: Date, range: WeekRange): boolean {
  const t = createdAt.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

export function breakdownFor(entries: LedgerEntry[], range: WeekRange, userId: string): Breakdown {
  const own = entries.filter((entry) => entry.userId === userId && inRange(entry.createdAt, range));
  const sum = (reason: PointReason) =>
    own.filter((entry) => entry.reason === reason).reduce((total, entry) => total + entry.amount, 0);
  return {
    tasks: sum("task_approved"),
    reviews: sum("review_submitted"),
    ideas: sum("idea_accepted") + sum("task_proposal_accepted"),
    adjustments: sum("manual_adjustment") + sum("reversal"),
  };
}

function sumUserPoints(entries: LedgerEntry[], userId: string, range?: WeekRange): number {
  return entries
    .filter((entry) => entry.userId === userId && (!range || inRange(entry.createdAt, range)))
    .reduce((total, entry) => total + entry.amount, 0);
}

function sumAgentPoints(entries: LedgerEntry[], agentId: string, range?: WeekRange): number {
  return entries
    .filter((entry) => entry.agentId === agentId && (!range || inRange(entry.createdAt, range)))
    .reduce((total, entry) => total + entry.amount, 0);
}

export function buildScoreboard(input: {
  entries: LedgerEntry[];
  users: ScoreboardUser[];
  agents: ScoreboardAgent[];
  range: WeekRange;
  taskTypes: TaskTypeConfig[];
  rules?: PointRule[];
  activeTaskLimit?: number;
  tasksGivenThisWeek?: Record<string, number>;
  currentUserId?: string;
  target?: number;
}): ScoreboardResult {
  const target = input.target ?? WEEKLY_TARGET;
  const rules = input.rules ?? DEFAULT_POINT_RULES;
  const activeTaskLimit = input.activeTaskLimit ?? ACTIVE_TASK_LIMIT;
  const tasksGiven = input.tasksGivenThisWeek ?? {};

  const rows: ScoreboardRow[] = input.users.map((user) => {
    const points = sumUserPoints(input.entries, user.id, input.range);
    const actualPct = target === 0 ? 0 : Math.round((points / target) * 100);
    // The bar uses floor so 499/500 doesn't look full; it is capped at 100 while
    // the true number (e.g. 620/500) is shown next to it.
    const barPct = target === 0 ? 0 : Math.floor((points / target) * 100);
    const byAgent = new Map<string, number>();
    for (const entry of input.entries) {
      if (entry.userId === user.id && entry.agentId && inRange(entry.createdAt, input.range)) {
        byAgent.set(entry.agentId, (byAgent.get(entry.agentId) ?? 0) + entry.amount);
      }
    }
    const agents = [...byAgent.entries()]
      .map(([agentId, agentPoints]) => {
        const agent = input.agents.find((candidate) => candidate.id === agentId);
        return { agentId, name: agent?.name ?? agentId, points: agentPoints };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    return {
      rank: 0,
      userId: user.id,
      name: user.name ?? user.id,
      points,
      progressPct: Math.min(100, Math.max(0, barPct)),
      actualPct,
      breakdown: breakdownFor(input.entries, input.range, user.id),
      agents,
      tasksGivenThisWeek: tasksGiven[user.id] ?? 0,
      isCurrentUser: user.id === input.currentUserId,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  let rank = 0;
  let previousPoints: number | undefined;
  for (const row of rows) {
    if (row.points !== previousPoints) {
      rank += 1;
      previousPoints = row.points;
    }
    row.rank = rank;
  }

  return {
    range: input.range,
    target,
    rows,
    rules: buildRulesBlock(input.taskTypes, rules, activeTaskLimit),
  };
}

export function buildRulesBlock(
  taskTypes: TaskTypeConfig[],
  rules: PointRule[] = DEFAULT_POINT_RULES,
  activeTaskLimit = ACTIVE_TASK_LIMIT
): RulesBlock {
  const enabledAmount = (ruleKey: string) => {
    const rule = rules.find((candidate) => candidate.ruleKey === ruleKey);
    return rule?.enabled ? rule.amount : null;
  };
  return {
    taskTypes: taskTypes.map(({ id, slug, name, description, points, maxPoints }) => ({
      id,
      slug,
      name,
      description,
      points,
      maxPoints,
    })),
    reviewPoints: enabledAmount("review_submitted"),
    ideaAccepted: enabledAmount("idea_accepted"),
    taskProposalAccepted: enabledAmount("task_proposal_accepted"),
    activeTaskLimit,
  };
}

// ── Fairness (bids panel) ────────────────────────────────────────────────────

export type BidderFairness = {
  agentId: string;
  agentPointsThisWeek: number;
  ownerPointsThisWeek: number;
  tasksGivenThisWeek: number;
  activeTasks: number;
};

/**
 * Fairness info for the bids panel. `tasksGiven` is accepted offers this week;
 * `activeTasks` is the agent's currently open workload (both supplied by the
 * task/offer owner — unit 3 — since PR 5 does not own the task model).
 */
export function getBidderFairness(
  agentIds: string[],
  input: {
    entries: LedgerEntry[];
    agents: ScoreboardAgent[];
    range: WeekRange;
    tasksGivenThisWeek?: Record<string, number>;
    activeTasks?: Record<string, number>;
  }
): BidderFairness[] {
  const tasksGiven = input.tasksGivenThisWeek ?? {};
  const active = input.activeTasks ?? {};
  return agentIds.map((agentId) => {
    const agent = input.agents.find((candidate) => candidate.id === agentId);
    return {
      agentId,
      agentPointsThisWeek: sumAgentPoints(input.entries, agentId, input.range),
      ownerPointsThisWeek: agent ? sumUserPoints(input.entries, agent.ownerId, input.range) : 0,
      tasksGivenThisWeek: tasksGiven[agentId] ?? 0,
      activeTasks: active[agentId] ?? 0,
    };
  });
}
