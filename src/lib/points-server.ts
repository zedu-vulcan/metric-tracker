/**
 * Database-backed points contract — server only.
 *
 * Implements `awardPoints`, `awardForRule`, `getUserPoints` and
 * `getAgentPoints` against the schema requested from unit 0
 * (`doc/points-schema-TEMP.sql`: `task_types`, `points_ledger`,
 * `point_rules`). The shared Prisma client is imported lazily so importing
 * this module never touches the database, and this module never leaks into a
 * client bundle (it is not imported by any client component).
 *
 * The raw SQL uses the snake_case names from `doc/points-schema-TEMP.sql`.
 * If unit 0 maps them to camelCase Prisma fields, either keep the SQL names
 * with `@@map` or update the queries here.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_PROJECT_ID,
  getWeekRange,
  idempotencyKeyFor,
  isPointReason,
  type LedgerEntry,
  type PointReason,
  type PointRule,
  type WeekRange,
} from "./points";

// ── Types ────────────────────────────────────────────────────────────────────

export type AwardMeta = {
  agentId?: string;
  sourceType?: "task" | "comment" | "idea";
  sourceId?: string;
  idempotencyKey?: string;
  grantedByUserId?: string;
  note?: string;
};

export type AwardResult = { awarded: boolean; entryId: string };

export type AwardOptions = {
  /** Injectable store (tests use an in-memory implementation). */
  db?: PointsDb;
  /** A caller's Prisma transaction — payout and the caller's write commit together. */
  tx?: Prisma.TransactionClient;
  projectId?: string;
  /** For `review_submitted`: the worker agent's owner id, to block self-reviews. */
  workerOwnerId?: string;
  now?: Date;
};

/** The minimal SQL surface `awardPoints` needs; implemented by Prisma and by tests. */
export interface PointsDb {
  /** Insert or ignore on `idempotency_key`. Returns the stored row either way. */
  insertLedgerRow(row: LedgerEntry): Promise<{ inserted: boolean; row: LedgerEntry | null }>;
  findLedgerByIdempotencyKey(key: string): Promise<LedgerEntry | null>;
  userExists(userId: string): Promise<boolean>;
  /** Owner id of an agent, or null when the agent doesn't exist. */
  agentOwnerId(agentId: string): Promise<string | null>;
  sumLedger(input: {
    userId?: string;
    agentId?: string;
    reason?: PointReason;
    range?: WeekRange;
  }): Promise<number>;
  getRule(ruleKey: string): Promise<PointRule | null>;
}

// ── Prisma adapter ───────────────────────────────────────────────────────────

type PointsSqlClient = Prisma.TransactionClient | {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};

export type { PointsSqlClient };

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

function toLedgerEntry(raw: RawLedgerRow): LedgerEntry {
  return {
    id: raw.id,
    userId: raw.user_id,
    agentId: raw.agent_id,
    projectId: raw.project_id,
    amount: raw.amount,
    reason: isPointReason(raw.reason) ? raw.reason : ("manual_adjustment" as PointReason),
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

const LEDGER_COLUMNS = Prisma.sql`id, user_id, agent_id, project_id, amount, reason, source_type, source_id, idempotency_key, granted_by_user_id, note, created_at`;

/** Wraps a Prisma client (or a transaction) with the `points_ledger` / `point_rules` queries. */
export function prismaPointsDb(client: PointsSqlClient): PointsDb {
  const findLedgerByIdempotencyKey = async (key: string): Promise<LedgerEntry | null> => {
    const rows = await client.$queryRaw<RawLedgerRow[]>`SELECT ${LEDGER_COLUMNS} FROM points_ledger WHERE idempotency_key = ${key} LIMIT 1`;
    return rows[0] ? toLedgerEntry(rows[0]) : null;
  };

  return {
    async insertLedgerRow(row) {
      const affected = await client.$executeRaw`
        INSERT INTO points_ledger
          (id, user_id, agent_id, project_id, amount, reason, source_type, source_id,
           idempotency_key, granted_by_user_id, note, created_at)
        VALUES
          (${row.id}, ${row.userId}, ${row.agentId}, ${row.projectId}, ${row.amount},
           ${row.reason}, ${row.sourceType}, ${row.sourceId}, ${row.idempotencyKey},
           ${row.grantedByUserId}, ${row.note}, ${row.createdAt})
        ON CONFLICT (idempotency_key) DO NOTHING`;
      if (affected > 0) return { inserted: true, row };
      return { inserted: false, row: await findLedgerByIdempotencyKey(row.idempotencyKey) };
    },

    findLedgerByIdempotencyKey,

    async userExists(userId) {
      const rows = await client.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} LIMIT 1`;
      return rows.length > 0;
    },

    async agentOwnerId(agentId) {
      const rows = await client.$queryRaw<{ ownerId: string }[]>`SELECT "ownerId" FROM "Agent" WHERE id = ${agentId} LIMIT 1`;
      return rows[0]?.ownerId ?? null;
    },

    async sumLedger({ userId, agentId, reason, range }) {
      const rows = await client.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(amount), 0)::int AS total
        FROM points_ledger
        WHERE (${userId ?? null}::text IS NULL OR user_id = ${userId ?? ""})
          AND (${agentId ?? null}::text IS NULL OR agent_id = ${agentId ?? ""})
          AND (${reason ?? null}::text IS NULL OR reason = ${reason ?? ""})
          AND (${range?.start ?? null}::timestamptz IS NULL OR created_at >= ${range?.start ?? new Date(0)})
          AND (${range?.end ?? null}::timestamptz IS NULL OR created_at < ${range?.end ?? new Date(0)})`;
      return rows[0]?.total ?? 0;
    },

    async getRule(ruleKey) {
      const rows = await client.$queryRaw<{
        rule_key: string;
        amount: number;
        enabled: boolean;
        weekly_cap: number | null;
      }[]>`SELECT rule_key, amount, enabled, weekly_cap FROM point_rules WHERE rule_key = ${ruleKey} LIMIT 1`;
      const rule = rows[0];
      if (!rule) return null;
      return { ruleKey: rule.rule_key, amount: rule.amount, enabled: rule.enabled, weeklyCap: rule.weekly_cap };
    },
  };
}

async function resolveDb(options?: AwardOptions): Promise<PointsDb> {
  if (options?.db) return options.db;
  if (options?.tx) return prismaPointsDb(options.tx);
  const { prisma } = await import("@/lib/prisma");
  return prismaPointsDb(prisma);
}

// ── The award contract ───────────────────────────────────────────────────────

/**
 * Idempotent award. Business conflicts (invalid input, unknown user, duplicate
 * key, blocked self-review) return `{ awarded: false, entryId }` and never
 * throw; infrastructure errors propagate so the caller can surface a 500.
 */
export async function awardPoints(
  userId: string,
  amount: number,
  reason: PointReason,
  meta?: AwardMeta,
  options?: AwardOptions
): Promise<AwardResult> {
  const db = await resolveDb(options);
  const now = options?.now ?? new Date();

  if (!Number.isInteger(amount) || amount === 0) return { awarded: false, entryId: "" };
  if (!isPointReason(reason)) return { awarded: false, entryId: "" };
  if (!userId) return { awarded: false, entryId: "" };
  if (!(await db.userExists(userId))) return { awarded: false, entryId: "" };

  if (reason === "review_submitted" && options?.workerOwnerId) {
    const reviewerOwnerId = meta?.agentId ? ((await db.agentOwnerId(meta.agentId)) ?? userId) : userId;
    if (reviewerOwnerId === options.workerOwnerId) return { awarded: false, entryId: "" };
  }

  const idempotencyKey = meta?.idempotencyKey ?? idempotencyKeyFor(reason, meta?.sourceType, meta?.sourceId);

  const row: LedgerEntry = {
    id: randomUUID(),
    userId,
    agentId: meta?.agentId ?? null,
    projectId: options?.projectId ?? DEFAULT_PROJECT_ID,
    amount,
    reason,
    sourceType: meta?.sourceType ?? null,
    sourceId: meta?.sourceId ?? null,
    idempotencyKey,
    grantedByUserId: meta?.grantedByUserId ?? null,
    note: meta?.note ?? null,
    createdAt: now,
  };

  const inserted = await db.insertLedgerRow(row);
  if (inserted.inserted && inserted.row) return { awarded: true, entryId: inserted.row.id };
  // Conflict (or defensive miss): report the existing entry without throwing.
  const existing = await db.findLedgerByIdempotencyKey(idempotencyKey);
  return { awarded: false, entryId: existing?.id ?? "" };
}

/**
 * Rule-aware award. Reads `point_rules`: skips disabled rules and enforces
 * `weekly_cap` by summing that reason's entries for the current week.
 */
export async function awardForRule(
  ruleKey: string,
  userId: string,
  meta?: AwardMeta,
  options?: AwardOptions & { range?: WeekRange }
): Promise<AwardResult> {
  const db = await resolveDb(options);
  const rule = await db.getRule(ruleKey);
  if (!rule || !rule.enabled) return { awarded: false, entryId: "" };

  let amount = rule.amount;
  if (rule.weeklyCap != null) {
    const range = options?.range ?? getWeekRange(options?.now);
    const used = await db.sumLedger({ userId, reason: ruleKey as PointReason, range });
    const remaining = rule.weeklyCap - used;
    if (remaining <= 0) return { awarded: false, entryId: "" };
    amount = Math.min(rule.amount, remaining);
  }

  return awardPoints(userId, amount, ruleKey as PointReason, meta, options);
}

// ── Point lookups ────────────────────────────────────────────────────────────

/** Total points for a user, optionally within a week. */
export async function getUserPoints(userId: string, range?: WeekRange, options?: AwardOptions): Promise<number> {
  const db = await resolveDb(options);
  return db.sumLedger({ userId, range });
}

/** Points attributed to one agent (unit 1's agent card), optionally within a week. */
export async function getAgentPoints(agentId: string, range?: WeekRange, options?: AwardOptions): Promise<number> {
  const db = await resolveDb(options);
  return db.sumLedger({ agentId, range });
}
