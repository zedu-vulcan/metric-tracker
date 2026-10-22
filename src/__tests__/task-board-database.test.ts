import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import EmbeddedPostgres from "embedded-postgres";
import { listTaskBoard, listTaskBoardOptions, prismaTaskBoardStore } from "@/lib/task-board-query";
import { taskBoardQuerySchema, taskBoardResponseSchema, taskBoardOptionsSchema } from "@/lib/schemas/task-board";

// Always provisions its own loopback-only database. Never accepts an external database URL.
const repository = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), "metric-task-board-pg-"));
const schemaPath = path.join(scratch, "schema.prisma");
const now = new Date("2026-10-22T09:00:00.000Z");
const context = { projectId: "board_project_a", userId: "board_user_a" };
let prisma: PrismaClient;
let postgres: EmbeddedPostgres | undefined;
let started = false;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") { probe.close(); reject(new Error("No test port")); return; }
      probe.close(() => resolve(address.port));
    });
  });
}

function prismaCommand(args: string[], databaseUrl: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repository, "node_modules/prisma/build/index.js"), ...args], {
      cwd: scratch, env: { ...process.env, DATABASE_URL: databaseUrl }, windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Scratch schema setup failed: ${errors}`)));
    child.stdin.end(input);
  });
}

before(async () => {
  // Both schema and CLI working directory are outside the project, without any .env copy.
  copyFileSync(path.join(repository, "prisma/schema.prisma"), schemaPath);
  const port = await freePort();
  const dataDir = path.resolve(scratch, "data");
  assert.equal(path.dirname(dataDir), path.resolve(scratch));
  postgres = new EmbeddedPostgres({
    databaseDir: dataDir, port, user: "postgres", password: "board_test_only",
    persistent: true, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  started = true;
  await postgres.createDatabase("board_test");
  const url = `postgresql://postgres:board_test_only@127.0.0.1:${port}/board_test`;
  // Existing migrations cannot replay on an empty DB (duplicate Agent creation).
  // Generate SQL from the unchanged schema and apply it only to this fresh cluster.
  const sql = await prismaCommand(["migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"], url);
  await prismaCommand(["db", "execute", "--schema", schemaPath, "--stdin"], url, sql);
  process.env.DATABASE_URL = url;
  prisma = (await import("@/lib/prisma")).prisma;

  await prisma.user.createMany({ data: [{ id: "board_user_a", name: "Member A" }, { id: "board_user_b", name: "Member B" }] });
  await prisma.project.createMany({ data: [
    { id: "board_project_a", name: "Board A", slug: "board-a", joinCode: "board_a", inviteToken: "board_invite_a" },
    { id: "board_project_b", name: "Board B", slug: "board-b", joinCode: "board_b", inviteToken: "board_invite_b" },
  ] });
  await prisma.goal.createMany({ data: [
    { id: "board_goal_a", projectId: context.projectId, title: "A goal", createdById: context.userId },
    { id: "board_goal_archived", projectId: context.projectId, title: "Archived goal", status: "archived", createdById: context.userId },
    { id: "board_goal_b", projectId: "board_project_b", title: "Foreign goal", createdById: "board_user_b" },
  ] });
  await prisma.workstream.createMany({ data: [
    { id: "board_stream_a", goalId: "board_goal_a", title: "Accepted work", status: "accepted" },
    { id: "board_stream_archived", goalId: "board_goal_archived", title: "Archived work", status: "accepted" },
    { id: "board_stream_proposed", goalId: "board_goal_a", title: "Proposed work", status: "proposed" },
    { id: "board_stream_b", goalId: "board_goal_b", title: "Foreign work", status: "accepted" },
  ] });
  await prisma.agent.createMany({ data: [
    { id: "board_agent_a1", projectId: context.projectId, ownerId: context.userId, name: "Worker A1", speciality: "seo", keyHash: "fixture_hash_a1", keyHint: "demo" },
    { id: "board_agent_a2", projectId: context.projectId, ownerId: context.userId, name: "Worker A2", speciality: "seo", keyHash: "fixture_hash_a2", keyHint: "demo" },
    { id: "board_agent_other", projectId: context.projectId, ownerId: "board_user_b", name: "Worker B", speciality: "seo", keyHash: "fixture_hash_other", keyHint: "demo" },
    { id: "board_agent_foreign", projectId: "board_project_b", ownerId: "board_user_b", name: "Foreign worker", speciality: "seo", keyHash: "fixture_hash_foreign", keyHint: "demo" },
  ] });
  await prisma.taskTypeDef.createMany({ data: [
    { projectId: context.projectId, slug: "seo", name: "SEO", points: 25, maxPoints: 50 },
    { projectId: context.projectId, slug: "free", name: "Free", points: 0, maxPoints: 0 },
    { projectId: context.projectId, slug: "archived", name: "Archived", points: 25, maxPoints: 25, isActive: false },
    { projectId: "board_project_b", slug: "historical", name: "Foreign type", points: 99, maxPoints: 99 },
  ] });
  const base = {
    projectId: context.projectId, workstreamId: "board_stream_a", status: "bidding" as const,
    taskType: "seo", points: 25, createdAt: now, updatedAt: now,
  };
  await prisma.task.createMany({ data: [
    ...Array.from({ length: 25 }, (_, index) => ({ ...base, id: `board_page_${String(index).padStart(2, "0")}`, title: `Page fixture ${index}` })),
    { ...base, id: "range_zero", title: "Range stored zero", points: 0 },
    { ...base, id: "range_stored", title: "Range stored 25" },
    { ...base, id: "range_fallback", title: "Range fallback 25", points: null },
    { ...base, id: "range_unknown", title: "Range unknown", taskType: "historical", points: null },
    { ...base, id: "range_archived", title: "Range archived", taskType: "archived", points: null },
    { ...base, id: "range_free", title: "Range free", taskType: "free", points: null },
    { ...base, id: "range_snapshot", title: "Range snapshot", points: 10 },
    { ...base, id: "offer_pending", title: "Offer pending", offeredToAgentId: "board_agent_a1", offerExpiresAt: new Date(now.getTime() + 1) },
    { ...base, id: "offer_indefinite", title: "Offer indefinite", offeredToAgentId: "board_agent_a1" },
    { ...base, id: "offer_expired", title: "Offer expired", offeredToAgentId: "board_agent_a1", offerExpiresAt: now },
    { ...base, id: "worker_a1", title: "Worker A1 task", assignedAgentId: "board_agent_a1", status: "in_progress" },
    { ...base, id: "worker_a2", title: "Worker A2 task", assignedAgentId: "board_agent_a2", status: "submitted" },
    { ...base, id: "worker_other", title: "Worker B task", assignedAgentId: "board_agent_other", status: "in_progress" },
    { ...base, id: "legacy", title: "Legacy task", workstreamId: null, taskType: null, points: null, status: "open" },
    { ...base, id: "inactive_goal", title: "Inactive goal task", workstreamId: "board_stream_archived" },
    { ...base, id: "proposed_work", title: "Proposed work task", workstreamId: "board_stream_proposed" },
    { ...base, id: "foreign_task", title: "Foreign task", projectId: "board_project_b", workstreamId: "board_stream_b" },
    { ...base, id: "corrupt_goal", title: "Corrupt joined goal", workstreamId: "board_stream_b" },
    { ...base, id: "corrupt_agent", title: "Corrupt joined agent", assignedAgentId: "board_agent_foreign" },
    { ...base, id: "search_literal", title: "Contains 100%_\\path exactly" },
    { ...base, id: "search_wildcard", title: "Contains 100anythingXpath exactly" },
    { ...base, id: "search_description", title: "Description example", description: "A rare description phrase" },
  ] });
}, { timeout: 120_000 });

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (postgres && started) await postgres.stop();
  // Verify the exact owned scratch target before any recursive removal on Windows.
  const resolved = realpathSync(scratch);
  assert.equal(path.dirname(resolved), realpathSync(tmpdir()));
  assert.ok(path.basename(resolved).startsWith("metric-task-board-pg-"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}, { timeout: 30_000 });

async function board(input: Record<string, unknown> = {}) {
  const result = await prisma.$transaction((tx) => listTaskBoard(prismaTaskBoardStore(tx), context, taskBoardQuerySchema.parse(input), now), { isolationLevel: "RepeatableRead" });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("Expected board");
  assert.ok(taskBoardResponseSchema.safeParse(result.data).success);
  return result.data;
}

describe("Task board against disposable PostgreSQL", () => {
  it("filters actual availability and expiry equality without personal-agent limits", async () => {
    const offers = await board({ q: "Offer" });
    assert.deepEqual(offers.tasks.map((task) => task.id), ["offer_expired"]);
    const allOffers = await board({ status: "all", q: "Offer" });
    assert.deepEqual(allOffers.tasks.map((task) => [task.id, task.offerPending]), [["offer_pending", true], ["offer_indefinite", true], ["offer_expired", false]]);
    for (const q of ["Legacy", "Inactive goal", "Proposed work", "Corrupt"]) assert.equal((await board({ q })).pagination.total, 0);
    // Owner A already has two active/review assignments; this must not hide global offers.
    assert.equal(offers.pagination.total, 1);
  });
  it("filters effective points before count/page, preserving zero and active fallback", async () => {
    const zero = await board({ status: "all", q: "range", minPoints: 0, maxPoints: 0 });
    assert.deepEqual(zero.tasks.map((task) => task.id), ["range_zero", "range_free"]);
    const exact = await board({ status: "all", q: "range", minPoints: 25, maxPoints: 25 });
    assert.deepEqual(exact.tasks.map((task) => task.id), ["range_stored", "range_fallback"]);
    assert.equal(exact.pagination.total, 2);
    const range = await board({ status: "all", q: "range", minPoints: 10, maxPoints: 25 });
    assert.deepEqual(range.tasks.map((task) => task.id), ["range_stored", "range_snapshot", "range_fallback"]);
    const unfiltered = await board({ status: "all", q: "range" });
    assert.equal(unfiltered.tasks.find((task) => task.id === "range_unknown")?.points, null);
    assert.equal(unfiltered.tasks.find((task) => task.id === "range_archived")?.points, null);
  });
  it("matches literal wildcard/backslash text and case-insensitive descriptions", async () => {
    assert.deepEqual((await board({ status: "all", q: "100%_\\path" })).tasks.map((task) => task.id), ["search_literal"]);
    assert.deepEqual((await board({ status: "all", q: "RARE DESCRIPTION" })).tasks.map((task) => task.id), ["search_description"]);
  });
  it("uses worker ownership, multiple owned agents and independent status filters", async () => {
    assert.deepEqual((await board({ status: "all", agent: "mine" })).tasks.map((task) => task.id), ["worker_a2", "worker_a1"]);
    assert.deepEqual((await board({ status: "all", agent: "board_agent_other" })).tasks.map((task) => task.id), ["worker_other"]);
    assert.deepEqual((await board({ status: "in_progress", agent: "mine", type: "seo", goal: "board_goal_a", q: "worker", minPoints: 25, maxPoints: 25 })).tasks.map((task) => task.id), ["worker_a1"]);
    assert.equal((await board({ agent: "mine" })).pagination.total, 0);
    assert.equal((await board({ status: "all", agent: "unassigned", q: "worker" })).pagination.total, 0);
  });
  it("returns all-status legacy rows and suppresses foreign joins without leaking foreign tasks", async () => {
    const legacy = (await board({ status: "all", q: "legacy" })).tasks[0];
    assert.equal(legacy.detailsUrl, null);
    assert.equal(legacy.goal, null);
    assert.equal(legacy.taskTypeLabel, "Not set");
    const corrupt = await board({ status: "all", q: "corrupt" });
    assert.equal(corrupt.pagination.total, 2);
    assert.equal(corrupt.tasks.find((task) => task.id === "corrupt_goal")?.goal, null);
    assert.equal(corrupt.tasks.find((task) => task.id === "corrupt_agent")?.assignedAgentId, null);
    assert.equal((await board({ status: "all", q: "foreign task" })).pagination.total, 0);
    assert.equal((await board({ status: "all", goal: "board_goal_archived" })).pagination.total, 1);
  });
  it("returns not-found for real foreign goal and agent IDs", async () => {
    for (const query of [{ goal: "board_goal_b" }, { agent: "board_agent_foreign" }]) {
      const result = await listTaskBoard(prismaTaskBoardStore(prisma), context, taskBoardQuerySchema.parse(query), now);
      assert.deepEqual(result, { status: "not_found" });
    }
  });
  it("paginates stable ties with the filtered count, unknown types and out-of-range pages", async () => {
    const first = await board({ status: "all", q: "page fixture" });
    const second = await board({ status: "all", q: "page fixture", page: 2 });
    assert.deepEqual(first.pagination, { page: 1, pageSize: 20, total: 25, totalPages: 2 });
    assert.equal(first.tasks.length, 20);
    assert.equal(second.tasks.length, 5);
    assert.deepEqual([...first.tasks, ...second.tasks].map((task) => task.id), Array.from({ length: 25 }, (_, index) => `board_page_${String(24 - index).padStart(2, "0")}`));
    const beyond = await board({ status: "all", q: "page fixture", page: 3 });
    assert.deepEqual(beyond.tasks, []);
    assert.equal(beyond.pagination.total, 25);
    assert.deepEqual((await board({ status: "all", type: "unknown_type" })).pagination, { page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
  it("returns project-wide options, historical labels and all owned agents", async () => {
    const result = await listTaskBoardOptions(prismaTaskBoardStore(prisma), context);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.ok(taskBoardOptionsSchema.safeParse(result.data).success);
    assert.deepEqual(result.data.types.find((type) => type.value === "historical"), { value: "historical", label: "historical", isActive: null });
    assert.equal(result.data.types.find((type) => type.value === "archived")?.isActive, false);
    assert.equal(result.data.goals.some((goal) => goal.id === "board_goal_archived"), true);
    assert.equal(result.data.goals.some((goal) => goal.id === "board_goal_b"), false);
    assert.deepEqual(result.data.agents.filter((agent) => agent.isMine).map((agent) => agent.id), ["board_agent_a1", "board_agent_a2"]);
    assert.equal(result.data.agents.some((agent) => agent.id === "board_agent_foreign"), false);
  });
  it("does not change task state when reading expired offers and availability", async () => {
    const before = await prisma.task.findMany({ orderBy: { id: "asc" } });
    await board({ q: "offer" });
    await board({ status: "all" });
    await listTaskBoardOptions(prismaTaskBoardStore(prisma), context);
    assert.deepEqual(await prisma.task.findMany({ orderBy: { id: "asc" } }), before);
  });
});
