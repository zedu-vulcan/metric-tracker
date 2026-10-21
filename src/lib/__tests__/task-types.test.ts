import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOpenApiDocument } from "@/lib/openapi";
import { taskTypeCreateSchema, taskTypeUpdateSchema } from "@/lib/schemas/task-types";
import {
  createTaskType,
  listTaskTypes,
  updateTaskType,
  type NewTaskTypeInput,
  type TaskTypeRecord,
  type TaskTypesStore,
} from "@/lib/task-types-server";

// ── In-memory TaskTypesStore ─────────────────────────────────────────────────

function inMemoryTaskTypesStore(seed: {
  admins?: string[];
  rows?: TaskTypeRecord[];
} = {}): TaskTypesStore & { rows: TaskTypeRecord[] } {
  const admins = new Set(seed.admins ?? []);
  const rows = [...(seed.rows ?? [])];

  return {
    rows,
    async list(includeInactive = false) {
      return rows
        .filter((row) => includeInactive || row.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async slugExists(slug, excludeId) {
      return rows.some((row) => row.slug === slug && row.id !== excludeId);
    },
    async userIsPlatformAdmin(userId) {
      return admins.has(userId);
    },
    async create(input) {
      const record: TaskTypeRecord = {
        id: `tt_${input.slug}`,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        points: input.points,
        maxPoints: input.maxPoints,
        isActive: input.isActive ?? true,
        createdAt: new Date("2026-10-20T09:00:00Z"),
        updatedAt: new Date("2026-10-20T09:00:00Z"),
      };
      rows.push(record);
      return record;
    },
    async update(id, patch, _updatedBy) {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return null;
      rows[index] = { ...rows[index], ...patch, updatedAt: new Date("2026-10-20T10:00:00Z") };
      return rows[index];
    },
  };
}

const ADMIN = { isAdmin: true, userId: "u_admin" };
const MEMBER = { isAdmin: false, userId: "u_member" };

const VALID: NewTaskTypeInput = {
  name: "Content",
  slug: "content",
  description: "Articles, posts, guides",
  points: 40,
  maxPoints: 50,
};

// ── createTaskType ───────────────────────────────────────────────────────────

describe("createTaskType", () => {
  it("creates a type for an admin and rejects for a non-admin (403 path)", async () => {
    const store = inMemoryTaskTypesStore({ admins: ["u_admin"] });

    const forbidden = await createTaskType(store, VALID, MEMBER);
    assert.equal(forbidden.status, "forbidden");
    assert.equal(store.rows.length, 0);

    const created = await createTaskType(store, VALID, ADMIN);
    assert.equal(created.status, "ok");
    if (created.status === "ok") {
      assert.equal(created.type.slug, "content");
      assert.equal(created.type.points, 40);
    }
    assert.equal(store.rows.length, 1);
  });

  it("rejects invalid points: negative, non-integer, max below points", async () => {
    const store = inMemoryTaskTypesStore({ admins: ["u_admin"] });

    const negative = await createTaskType(store, { ...VALID, points: -1 }, ADMIN);
    assert.equal(negative.status, "invalid");

    const fractional = await createTaskType(store, { ...VALID, points: 20.5 }, ADMIN);
    assert.equal(fractional.status, "invalid");

    const maxTooLow = await createTaskType(store, { ...VALID, maxPoints: 30 }, ADMIN);
    assert.equal(maxTooLow.status, "invalid");

    assert.equal(store.rows.length, 0);
  });

  it("rejects an empty slug, a missing name, and a duplicate slug", async () => {
    const store = inMemoryTaskTypesStore({ admins: ["u_admin"], rows: [
      { id: "tt_content", slug: "content", name: "Content", description: null, points: 40, maxPoints: 50, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ] });

    const emptySlug = await createTaskType(store, { ...VALID, slug: "  " }, ADMIN);
    assert.equal(emptySlug.status, "invalid");

    const missingName = await createTaskType(store, { ...VALID, name: "   " }, ADMIN);
    assert.equal(missingName.status, "invalid");

    const duplicate = await createTaskType(store, { ...VALID, slug: "content" }, ADMIN);
    assert.equal(duplicate.status, "invalid");
    if (duplicate.status === "invalid") {
      assert.ok(duplicate.errors.some((message) => message.includes("slug")));
    }

    assert.equal(store.rows.length, 1);
  });
});

// ── updateTaskType ───────────────────────────────────────────────────────────

const EXISTING: TaskTypeRecord = {
  id: "tt_seo",
  slug: "seo",
  name: "SEO",
  description: null,
  points: 25,
  maxPoints: 50,
  isActive: true,
  createdAt: new Date("2026-10-20T09:00:00Z"),
  updatedAt: new Date("2026-10-20T09:00:00Z"),
};

describe("updateTaskType", () => {
  it("rejects non-admins (403 path) and unknown ids", async () => {
    const store = inMemoryTaskTypesStore({ admins: ["u_admin"], rows: [EXISTING] });

    const forbidden = await updateTaskType(store, "tt_seo", { points: 30 }, MEMBER);
    assert.equal(forbidden.status, "forbidden");

    const missing = await updateTaskType(store, "tt_ghost", { points: 30 }, ADMIN);
    assert.equal(missing.status, "not_found");
  });

  it("archives instead of deleting: isActive false keeps the row out of the active list", async () => {
    const store = inMemoryTaskTypesStore({ admins: ["u_admin"], rows: [EXISTING] });

    const archived = await updateTaskType(store, "tt_seo", { isActive: false }, ADMIN);
    assert.equal(archived.status, "ok");

    assert.equal((await listTaskTypes(store)).length, 0);
    assert.equal((await listTaskTypes(store, true)).length, 1);
  });

  it("validates the merged record and slug uniqueness on edit", async () => {
    const store = inMemoryTaskTypesStore({
      admins: ["u_admin"],
      rows: [EXISTING, { ...EXISTING, id: "tt_content", slug: "content", name: "Content" }],
    });

    const maxTooLow = await updateTaskType(store, "tt_seo", { maxPoints: 20 }, ADMIN);
    assert.equal(maxTooLow.status, "invalid");

    const duplicateSlug = await updateTaskType(store, "tt_seo", { slug: "content" }, ADMIN);
    assert.equal(duplicateSlug.status, "invalid");

    const renamed = await updateTaskType(store, "tt_seo", { name: "Technical SEO" }, ADMIN);
    assert.equal(renamed.status, "ok");
    if (renamed.status === "ok") assert.equal(renamed.type.name, "Technical SEO");
  });
});

// ── Zod schemas ──────────────────────────────────────────────────────────────

describe("task-type schemas", () => {
  it("validates a full create payload and rejects max below points", () => {
    assert.equal(taskTypeCreateSchema.safeParse(VALID).success, true);
    assert.equal(taskTypeCreateSchema.safeParse({ ...VALID, maxPoints: 30 }).success, false);
    assert.equal(taskTypeCreateSchema.safeParse({ ...VALID, slug: "Bad Slug!" }).success, false);
  });

  it("rejects empty updates", () => {
    assert.equal(taskTypeUpdateSchema.safeParse({}).success, false);
    assert.equal(taskTypeUpdateSchema.safeParse({ isActive: false }).success, true);
  });
});

// ── OpenAPI: agent key is read-only on task types ────────────────────────────

describe("task-types OpenAPI registration", () => {
  it("lets an agent key GET but not write, and documents 403", () => {
    const doc = getOpenApiDocument();
    assert.ok(doc.paths);
    assert.ok(doc.paths["/api/task-types"]);

    const get = doc.paths["/api/task-types"].get;
    assert.ok(get);
    assert.ok(get.security?.some((scheme) => "agentKey" in scheme), "GET accepts an agent key");

    const post = doc.paths["/api/task-types"].post;
    assert.ok(post);
    assert.ok(!post.security?.some((scheme) => "agentKey" in scheme), "POST must not accept an agent key");
    assert.ok(post.responses, "POST documents responses");
    assert.ok(post.responses["403"], "POST documents 403");

    const patch = doc.paths["/api/task-types/{id}"].patch;
    assert.ok(patch);
    assert.ok(!patch.security?.some((scheme) => "agentKey" in scheme), "PATCH must not accept an agent key");
    assert.ok(patch.responses, "PATCH documents responses");
    assert.ok(patch.responses["403"], "PATCH documents 403");
  });
});
