/**
 * Task types data layer — server only.
 *
 * Implements the admin contract for `task_types` against the schema requested
 * from unit 0 (`doc/points-schema-TEMP.sql`): platform-admins create/update,
 * everyone (session or agent key) reads active types, and types are archived
 * (`is_active = false`) rather than deleted.
 *
 * Like `points-server`, the shared Prisma client is only imported by the
 * caller (routes/pages); tests inject an in-memory store.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { validateTaskType } from "./points";
import type { PointsSqlClient } from "./points-server";

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskTypeRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  points: number;
  maxPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTaskTypeInput = {
  name: string;
  slug: string;
  description?: string | null;
  points: number;
  maxPoints: number;
  isActive?: boolean;
};

export type TaskTypePatch = Partial<NewTaskTypeInput>;

export type TaskTypeActor = { isAdmin: boolean; userId: string };

export type TaskTypeMutationResult =
  | { status: "ok"; type: TaskTypeRecord }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "invalid"; errors: string[] };

export interface TaskTypesStore {
  list(includeInactive?: boolean): Promise<TaskTypeRecord[]>;
  findById(id: string): Promise<TaskTypeRecord | null>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  userIsPlatformAdmin(userId: string): Promise<boolean>;
  create(input: NewTaskTypeInput & { updatedBy: string }): Promise<TaskTypeRecord>;
  update(id: string, patch: TaskTypePatch, updatedBy: string): Promise<TaskTypeRecord | null>;
}

// ── Prisma adapter ───────────────────────────────────────────────────────────

type RawTaskTypeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  points: number;
  max_points: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

function toTaskTypeRecord(raw: RawTaskTypeRow): TaskTypeRecord {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    points: raw.points,
    maxPoints: raw.max_points,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

const TASK_TYPE_COLUMNS = Prisma.sql`id, slug, name, description, points, max_points, is_active, created_at, updated_at`;

/** Wraps a Prisma client (or transaction) with the `task_types` / platform-admin queries. */
export function prismaTaskTypesStore(client: PointsSqlClient): TaskTypesStore {
  return {
    async list(includeInactive = false) {
      const rows = await client.$queryRaw<RawTaskTypeRow[]>`
        SELECT ${TASK_TYPE_COLUMNS} FROM task_types
        WHERE (${includeInactive} OR is_active = true)
        ORDER BY name ASC`;
      return rows.map(toTaskTypeRecord);
    },

    async findById(id) {
      const rows = await client.$queryRaw<RawTaskTypeRow[]>`
        SELECT ${TASK_TYPE_COLUMNS} FROM task_types WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toTaskTypeRecord(rows[0]) : null;
    },

    async slugExists(slug, excludeId) {
      const rows = await client.$queryRaw<{ id: string }[]>`
        SELECT id FROM task_types
        WHERE slug = ${slug} AND (${excludeId ?? null}::text IS NULL OR id <> ${excludeId ?? ""})
        LIMIT 1`;
      return rows.length > 0;
    },

    async userIsPlatformAdmin(userId) {
      const rows = await client.$queryRaw<{ is_platform_admin: boolean }[]>`
        SELECT is_platform_admin FROM "User" WHERE id = ${userId} LIMIT 1`;
      return rows[0]?.is_platform_admin ?? false;
    },

    async create(input) {
      const now = new Date();
      const rows = await client.$queryRaw<RawTaskTypeRow[]>`
        INSERT INTO task_types (id, slug, name, description, points, max_points, is_active, created_at, updated_at, updated_by)
        VALUES (${randomUUID()}, ${input.slug}, ${input.name}, ${input.description ?? null}, ${input.points},
                ${input.maxPoints}, ${input.isActive ?? true}, ${now}, ${now}, ${input.updatedBy})
        RETURNING ${TASK_TYPE_COLUMNS}`;
      return toTaskTypeRecord(rows[0]);
    },

    async update(id, patch, updatedBy) {
      const fragments: Prisma.Sql[] = [];
      if (patch.slug !== undefined) fragments.push(Prisma.sql`slug = ${patch.slug}`);
      if (patch.name !== undefined) fragments.push(Prisma.sql`name = ${patch.name}`);
      if (patch.description !== undefined) fragments.push(Prisma.sql`description = ${patch.description}`);
      if (patch.points !== undefined) fragments.push(Prisma.sql`points = ${patch.points}`);
      if (patch.maxPoints !== undefined) fragments.push(Prisma.sql`max_points = ${patch.maxPoints}`);
      if (patch.isActive !== undefined) fragments.push(Prisma.sql`is_active = ${patch.isActive}`);
      fragments.push(Prisma.sql`updated_at = ${new Date()}`, Prisma.sql`updated_by = ${updatedBy}`);
      const rows = await client.$queryRaw<RawTaskTypeRow[]>`
        UPDATE task_types SET ${Prisma.join(fragments, ", ")} WHERE id = ${id}
        RETURNING ${TASK_TYPE_COLUMNS}`;
      return rows[0] ? toTaskTypeRecord(rows[0]) : null;
    },
  };
}

export function serializeTaskType(record: TaskTypeRecord) {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    points: record.points,
    maxPoints: record.maxPoints,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ── The admin contract ───────────────────────────────────────────────────────

/** Numeric + slug validation shared by create/update and the client form. */
export function validateTaskTypeInput(input: { slug: string; points: number; maxPoints: number }): string[] {
  const errors = validateTaskType({ points: input.points, maxPoints: input.maxPoints });
  if (!input.slug.trim()) errors.push("Slug is required.");
  return errors;
}

/** Active types for any authenticated principal; archived types for admins. */
export async function listTaskTypes(store: TaskTypesStore, includeInactive = false): Promise<TaskTypeRecord[]> {
  return store.list(includeInactive);
}

export async function createTaskType(
  store: TaskTypesStore,
  input: NewTaskTypeInput,
  actor: TaskTypeActor
): Promise<TaskTypeMutationResult> {
  if (!actor.isAdmin) return { status: "forbidden" };

  const errors = validateTaskTypeInput({ slug: input.slug, points: input.points, maxPoints: input.maxPoints });
  if (!input.name.trim()) errors.unshift("Name is required.");
  if (errors.length > 0) return { status: "invalid", errors };
  if (await store.slugExists(input.slug)) {
    return { status: "invalid", errors: ["Another task type already uses this slug."] };
  }

  const type = await store.create({ ...input, updatedBy: actor.userId });
  return { status: "ok", type };
}

export async function updateTaskType(
  store: TaskTypesStore,
  id: string,
  patch: TaskTypePatch,
  actor: TaskTypeActor
): Promise<TaskTypeMutationResult> {
  if (!actor.isAdmin) return { status: "forbidden" };

  const existing = await store.findById(id);
  if (!existing) return { status: "not_found" };

  const merged = {
    slug: patch.slug ?? existing.slug,
    points: patch.points ?? existing.points,
    maxPoints: patch.maxPoints ?? existing.maxPoints,
  };
  const errors = validateTaskTypeInput(merged);
  if (errors.length > 0) return { status: "invalid", errors };
  if (patch.slug !== undefined && patch.slug !== existing.slug && (await store.slugExists(patch.slug, id))) {
    return { status: "invalid", errors: ["Another task type already uses this slug."] };
  }

  const updated = await store.update(id, patch, actor.userId);
  if (!updated) return { status: "not_found" };
  return { status: "ok", type: updated };
}
