import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { ChildProcess } from "node:child_process";
import type EmbeddedPostgres from "embedded-postgres";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address && typeof address === "object") {
        const { port } = address;
        probe.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine a free port"));
      }
    });
  });
}

/** Stops a process and its children: `taskkill /T` on Windows, the process group elsewhere. */
function killTree(pid: number): Promise<void> {
  if (process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // Already gone.
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => resolve());
  });
}

function cleanStaleScratchDirs() {
  for (const entry of readdirSync(tmpdir())) {
    if (entry.startsWith(PG_DATA_DIR_PREFIX)) {
      rmSync(path.join(tmpdir(), entry), { recursive: true, force: true });
    }
  }
}

/**
 * Full lifecycle integration suite.
 *
 * Boots a disposable PostgreSQL (embedded-postgres) plus `next dev`, then drives the
 * real HTTP API inside one project: goal → idea → workstream → task → bid → offer →
 * accept-offer → delivery → peer reviews → changes → re-delivery → approval and points,
 * plus the edge cases: other projects can't see or touch the work, the 2-revision limit
 * reopens the task, the 2-active-task limit, and 24h offer expiration.
 *
 * By default the suite NEVER touches .env or DATABASE_URL — it starts its own scratch
 * database. Set TEST_DATABASE_URL to run against a different disposable postgres that
 * already has the migrations applied.
 */

let APP_PORT = 0;
let APP_BASE = "";
let PG_PORT = 0;
const RUN_ID = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const PG_DATA_DIR = path.join(tmpdir(), `metric-tracker-e2e-pg-${RUN_ID}`);
const PG_DATA_DIR_PREFIX = "metric-tracker-e2e-pg-";
const DB_NAME = "metric_tracker_test";

const SETUP_TIMEOUT_MS = 240_000;

type Json = Record<string, unknown>;

interface ApiResult {
  status: number;
  body: Json | Json[] | null;
}

interface Actor {
  key: string;
  id: string;
  ownerId: string;
}

interface Fixtures {
  owner: { id: string; sessionToken: string };
  admin: { id: string; sessionToken: string };
  member: { id: string; sessionToken: string };
  projectId: string;
  agentA: Actor; // the goal owner's agent: proposes ideas and tasks
  agentB: Actor; // worker
  agentC: Actor; // reviewer
  agentD: Actor; // reviewer
  agentE: Actor; // reviewer, and the worker in the revision-limit case
  agentF: Actor; // the fifth owner's agent, for idea upvotes
  agentA2: Actor; // shares agentA's owner
  outsider: Actor; // an agent in another project
}

const ctx: {
  prisma?: import("@prisma/client").PrismaClient;
  pg?: EmbeddedPostgres;
  server?: ChildProcess;
  serverLog: string[];
  fx?: Fixtures;
  goalId?: string;
  workstreamId?: string;
  taskId?: string;
} = { serverLog: [] };

function serverEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`,
    NEXTAUTH_URL: APP_BASE,
    PORT: String(APP_PORT),
    NODE_ENV: "development" as const,
  };
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_BASE}/api/health`);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Dev server did not become ready in ${timeoutMs}ms. Last error: ${String(lastError)}\n` +
      `--- server log tail ---\n${ctx.serverLog.slice(-40).join("")}`,
  );
}

function runPrismaCli(args: string[], options: { stdin?: string; databaseUrl?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = options.databaseUrl ? { ...process.env, DATABASE_URL: options.databaseUrl } : process.env;
    const child = spawn(
      process.execPath,
      [path.join("node_modules", "prisma", "build", "index.js"), ...args],
      { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"] },
    );
    // Only stdout is returned: stderr carries notices (like update banners) that would corrupt a SQL script.
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (errors += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`prisma ${args.join(" ")} exited ${code}:\n${output}${errors}`));
    });
    if (options.stdin !== undefined) child.stdin.write(options.stdin);
    child.stdin.end();
  });
}

/**
 * The team's migration history cannot deploy to a fresh database: both
 * 20261020120000_add_agent_table and 20261020163500_add_goals_workstreams_agents_comments
 * CREATE TABLE "Agent", so `prisma migrate deploy` fails partway with
 * `relation "Agent" already exists`. The scratch test database therefore skips migration
 * replay and is provisioned directly from the final schema, which matches the end state of
 * a fully migrated database. (See doc/task-revisions.md: the mismatch is known and owned
 * elsewhere; this suite must not edit existing migrations to fix it.)
 */
async function provisionFreshDatabase(databaseUrl: string): Promise<void> {
  const script = await runPrismaCli([
    "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script",
  ]);
  await runPrismaCli(["db", "execute", "--stdin"], { stdin: script, databaseUrl });
}

/** Calls the API as the project owner (session + project header) or as an agent (key only). */
async function call(
  method: string,
  pathAndQuery: string,
  options: { body?: unknown; agent?: Actor; sessionToken?: string } = {}
): Promise<ApiResult> {
  const fx = ctx.fx;
  assert.ok(fx, "fixtures ready");
  const headers: Record<string, string> = {};
  if (options.agent) {
    headers["x-agent-key"] = options.agent.key;
  } else {
    headers["cookie"] = `next-auth.session-token=${options.sessionToken ?? fx.owner.sessionToken}`;
    headers["x-project-id"] = fx.projectId;
  }
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${APP_BASE}${pathAndQuery}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let body: ApiResult["body"] = null;
  try {
    body = (await res.json()) as ApiResult["body"];
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function asObject(result: ApiResult): Json {
  assert.ok(result.body && !Array.isArray(result.body), `expected JSON object, got ${JSON.stringify(result.body)}`);
  return result.body;
}

function errorText(result: ApiResult): string {
  const body = result.body;
  return body && !Array.isArray(body) && typeof body.error === "string" ? body.error : JSON.stringify(body);
}

async function taskFromWorkstream(taskId: string): Promise<Json> {
  const res = await call("GET", `/api/workstreams/${ctx.workstreamId}`);
  assert.equal(res.status, 200, errorText(res));
  const task = (asObject(res).tasks as Json[]).find((t) => t.id === taskId);
  assert.ok(task, `task ${taskId} listed in workstream`);
  return task;
}

async function createTask(title: string): Promise<string> {
  const created = await call("POST", `/api/workstreams/${ctx.workstreamId}/tasks`, {
    agent: ctx.fx!.agentA,
    body: { title, taskType: "content" },
  });
  assert.equal(created.status, 201, errorText(created));
  assert.equal(asObject(created).status, "open");
  return asObject(created).id as string;
}

async function comment(taskId: string, agent: Actor, body: Json) {
  return call("POST", `/api/tasks/${taskId}/comments`, { agent, body });
}

async function bidOfferAccept(taskId: string, worker: Actor) {
  const bid = await comment(taskId, worker, { type: "bid", body: `Bidding for ${taskId}` });
  assert.equal(bid.status, 201, errorText(bid));
  const offer = await call("POST", `/api/tasks/${taskId}/offer`, { body: { agentId: worker.id } });
  assert.equal(offer.status, 200, errorText(offer));
  const accept = await call("POST", `/api/tasks/${taskId}/accept-offer`, { agent: worker, body: {} });
  assert.equal(accept.status, 200, errorText(accept));
  assert.equal(asObject(accept).status, "in_progress");
}

async function deliver(taskId: string, worker: Actor, attachment: string) {
  const res = await comment(taskId, worker, { type: "delivery", title: "Delivery", body: "See attachment.", attachment });
  assert.equal(res.status, 201, errorText(res));
}

async function review(taskId: string, reviewer: Actor, verdict: "approve" | "changes") {
  const res = await comment(taskId, reviewer, { type: "review", verdict, score: 7, body: `Verdict: ${verdict}` });
  assert.equal(res.status, 201, errorText(res));
  return asObject(res);
}

async function ledger(sourceKey: string) {
  return ctx.prisma!.pointsLedger.findUnique({ where: { idempotencyKey: sourceKey } });
}

before(
  async () => {
    [APP_PORT, PG_PORT] = await Promise.all([getFreePort(), getFreePort()]);
    APP_BASE = `http://localhost:${APP_PORT}`;

    cleanStaleScratchDirs();

    const databaseUrl =
      process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`;

    if (!process.env.TEST_DATABASE_URL) {
      const { default: EmbeddedPostgres } = await import("embedded-postgres");
      const pg = new EmbeddedPostgres({
        databaseDir: PG_DATA_DIR,
        user: "postgres",
        password: "postgres",
        port: PG_PORT,
        persistent: false,
      });
      ctx.pg = pg;
      if (existsSync(PG_DATA_DIR)) rmSync(PG_DATA_DIR, { recursive: true, force: true });
      await pg.initialise();
      await pg.start();
      await pg.createDatabase(DB_NAME);
      await provisionFreshDatabase(databaseUrl);
    } else {
      // The external database must be disposable; it gets the migrations applied.
      await runPrismaCli(["migrate", "deploy"], { databaseUrl });
    }

    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = await import("@/lib/prisma");
    const { hashAgentKey } = await import("@/lib/agents");
    // `@/lib/projects` pulls in NextAuth, which this runner can't load, so projects are built here.
    const { DEFAULT_POINT_RULES, DEFAULT_TASK_TYPES } = await import("@/lib/points");
    ctx.prisma = prisma;
    const createProject = (ownerId: string, name: string) =>
      prisma.project.create({
        data: {
          name,
          slug: `e2e-${randomBytes(6).toString("hex")}`,
          joinCode: randomBytes(4).toString("hex"),
          inviteToken: randomBytes(16).toString("hex"),
          createdById: ownerId,
          members: { create: { userId: ownerId, role: "owner" } },
          taskTypes: { create: DEFAULT_TASK_TYPES },
          pointRules: { create: DEFAULT_POINT_RULES },
        },
      });
    const joinProject = (userId: string, projectId: string) =>
      prisma.projectMember.create({ data: { userId, projectId, role: "member" } });

    const mkUser = (label: string) =>
      prisma.user.create({ data: { email: `lifecycle-${label}-${RUN_ID}@test.local`, name: `E2E ${label}` } });
    const [owner, ownerB, ownerC, ownerD, ownerE, ownerF, stranger] = await Promise.all(
      ["owner", "owner-b", "owner-c", "owner-d", "owner-e", "owner-f", "stranger"].map(mkUser),
    );

    const project = await createProject(owner.id, `E2E ${RUN_ID}`);
    const elsewhere = await createProject(stranger.id, `E2E elsewhere ${RUN_ID}`);
    for (const member of [ownerB, ownerC, ownerD, ownerE, ownerF]) await joinProject(member.id, project.id);

    const sessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { sessionToken, userId: owner.id, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    await prisma.projectMember.update({
      where: { projectId_userId: { projectId: project.id, userId: ownerC.id } },
      data: { role: "admin" },
    });
    const adminSessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { sessionToken: adminSessionToken, userId: ownerC.id, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const memberSessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { sessionToken: memberSessionToken, userId: ownerB.id, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const mkAgent = async (label: string, ownerId: string, projectId = project.id): Promise<Actor> => {
      const key = `zedu_ak_e2e_${label}_${randomBytes(8).toString("hex")}`;
      const agent = await prisma.agent.create({
        data: { name: `E2E ${label}`, speciality: "content", ownerId, projectId, keyHash: hashAgentKey(key), keyHint: "e2e" },
      });
      return { key, id: agent.id, ownerId };
    };

    ctx.fx = {
      owner: { id: owner.id, sessionToken },
      admin: { id: ownerC.id, sessionToken: adminSessionToken },
      member: { id: ownerB.id, sessionToken: memberSessionToken },
      projectId: project.id,
      agentA: await mkAgent("a", owner.id),
      agentB: await mkAgent("b", ownerB.id),
      agentC: await mkAgent("c", ownerC.id),
      agentD: await mkAgent("d", ownerD.id),
      agentE: await mkAgent("e", ownerE.id),
      agentF: await mkAgent("f", ownerF.id),
      agentA2: await mkAgent("a2", owner.id),
      outsider: await mkAgent("x", stranger.id, elsewhere.id),
    };

    const server = spawn(
      process.execPath,
      [path.join("node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(APP_PORT)],
      { env: serverEnv(), stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
    );
    ctx.server = server;
    server.stdout.on("data", (chunk: Buffer) => {
      ctx.serverLog.push(chunk.toString());
      if (ctx.serverLog.length > 200) ctx.serverLog.shift();
    });
    server.stderr.on("data", (chunk: Buffer) => ctx.serverLog.push(chunk.toString()));
    server.on("error", (error) => ctx.serverLog.push(`server error: ${String(error)}`));

    await waitForServer(SETUP_TIMEOUT_MS);
  },
  { timeout: SETUP_TIMEOUT_MS + 60_000 },
);

after(
  async () => {
    const { prisma, server, pg } = ctx;
    try {
      if (prisma && process.env.TEST_DATABASE_URL) {
        // Deleting the projects cascades to their goals, tasks, agents and points.
        await prisma.project.deleteMany({ where: { name: { contains: RUN_ID } } });
        await prisma.user.deleteMany({ where: { email: { contains: `-${RUN_ID}@test.local` } } });
      }
    } finally {
      if (server?.pid) await killTree(server.pid);
      // pg_ctl / SIGTERM cannot always reach the postmaster on Windows; force-kill the
      // recorded postmaster PID before removing its data directory.
      const pidFile = path.join(PG_DATA_DIR, "postmaster.pid");
      if (process.platform === "win32" && existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0].trim());
        if (Number.isInteger(pid) && pid > 0) await killTree(pid);
      }
      if (pg) {
        // pg.stop() waits on pg_ctl, which can hang on Windows once the postmaster is
        // already gone, so give up quickly — the tree-kill above did the real work.
        try {
          await Promise.race([pg.stop(), new Promise((resolve) => setTimeout(resolve, 5_000))]);
        } catch {
          // Already stopped.
        }
      }
      if (existsSync(PG_DATA_DIR)) rmSync(PG_DATA_DIR, { recursive: true, force: true });
      await ctx.prisma?.$disconnect();
    }
  },
  { timeout: 120_000 },
);

describe("full lifecycle: goal → idea → workstream → task → bid → delivery → peer reviews → approval and points", () => {
  it("blocks agents from creating goals", async () => {
    const res = await call("POST", "/api/goals", { agent: ctx.fx!.agentA, body: { title: "Agent goal", type: "seo" } });
    assert.equal(res.status, 403);
  });

  it("step 1 — a member creates a goal in the project", async () => {
    const res = await call("POST", "/api/goals", {
      body: { title: `E2E Goal ${RUN_ID}`, description: "Lifecycle goal", type: "seo" },
    });
    assert.equal(res.status, 201, errorText(res));
    ctx.goalId = asObject(res).id as string;
  });

  it("keeps the goal out of other projects", async () => {
    const one = await call("GET", `/api/goals/${ctx.goalId}`, { agent: ctx.fx!.outsider });
    assert.equal(one.status, 404);
    const list = await call("GET", "/api/goals", { agent: ctx.fx!.outsider });
    assert.equal(list.status, 200);
    assert.ok((list.body as Json[]).every((goal) => goal.id !== ctx.goalId));
    const idea = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      agent: ctx.fx!.outsider,
      body: { title: "Sneaky idea" },
    });
    assert.equal(idea.status, 404);
  });

  it("blocks accepting an idea proposed by the caller's own agent (conflict of interest)", async () => {
    const proposed = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      agent: ctx.fx!.agentA,
      body: { title: `E2E Self-Approval Idea ${RUN_ID}` },
    });
    assert.equal(proposed.status, 201, errorText(proposed));
    const ownIdeaId = asObject(proposed).id as string;

    const res = await call("POST", `/api/ideas/${ownIdeaId}/accept`);
    assert.equal(res.status, 403);
    assert.match(errorText(res), /conflict of interest/i);
  });

  it("step 2 — an agent proposes an idea and the goal owner accepts it", async () => {
    const proposed = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      agent: ctx.fx!.agentB,
      body: { title: `E2E Workstream ${RUN_ID}`, description: "Fix on-page SEO" },
    });
    assert.equal(proposed.status, 201, errorText(proposed));
    ctx.workstreamId = asObject(proposed).id as string;

    const accepted = await call("POST", `/api/ideas/${ctx.workstreamId}/accept`);
    assert.equal(accepted.status, 200, errorText(accepted));

    const pay = await ledger(`idea:${ctx.workstreamId}`);
    assert.equal(pay?.userId, ctx.fx!.agentB.ownerId, "an accepted idea pays its proposer's owner");
    assert.equal(Number(pay?.amount), 2);
  });

  it("five upvotes from other owners' agents promote an idea, paying half a point each", async () => {
    const proposed = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      agent: ctx.fx!.agentA,
      body: { title: `E2E Upvoted idea ${RUN_ID}` },
    });
    assert.equal(proposed.status, 201, errorText(proposed));
    const ideaId = asObject(proposed).id as string;
    const upvote = (agent: Actor, reason = "This targets the pages that fail the most checks.") =>
      call("POST", `/api/ideas/${ideaId}/upvotes`, { agent, body: { reason } });

    assert.equal((await upvote(ctx.fx!.agentA)).status, 403, "not your own idea");
    assert.equal((await upvote(ctx.fx!.agentA2)).status, 403, "not an idea from your owner's agent");
    assert.equal((await upvote(ctx.fx!.outsider)).status, 404, "not an idea in another project");
    assert.equal((await upvote(ctx.fx!.agentB, "short")).status, 400, "a reason is required");

    const voters = [ctx.fx!.agentB, ctx.fx!.agentC, ctx.fx!.agentD, ctx.fx!.agentE, ctx.fx!.agentF];
    for (const [index, voter] of voters.entries()) {
      const res = await upvote(voter);
      assert.equal(res.status, 201, errorText(res));
      const body = asObject(res);
      assert.equal(body.promoted, index === voters.length - 1);
      const pay = await ledger(`upvote:${(body.upvote as Json).id}`);
      assert.equal(pay?.userId, voter.ownerId);
      assert.equal(Number(pay?.amount), 0.5);
      if (index === 0) assert.equal((await upvote(voter)).status, 409, "once per idea");
    }

    const goal = asObject(await call("GET", `/api/goals/${ctx.goalId}`));
    const promoted = (goal.acceptedWorkstreams as Json[]).find((w) => w.id === ideaId);
    assert.ok(promoted, "the idea is now a workstream");
    assert.equal((promoted.upvotes as Json[]).length, 5);
    assert.equal(Number((await ledger(`idea:${ideaId}`))?.amount), 2, "the proposer is paid on promotion");
    assert.equal((await upvote(ctx.fx!.agentB)).status, 400, "accepted ideas take no upvotes");
  });

  it("step 3 — an agent creates a task with one of the project's task types", async () => {
    const unknown = await call("POST", `/api/workstreams/${ctx.workstreamId}/tasks`, {
      agent: ctx.fx!.agentA,
      body: { title: "Unknown type", taskType: "not_a_type" },
    });
    assert.equal(unknown.status, 400);
    ctx.taskId = await createTask(`E2E Lifecycle Task ${RUN_ID}`);
  });

  it("step 4 — bid, offer, accept-offer → in_progress; then delivery", async () => {
    await bidOfferAccept(ctx.taskId!, ctx.fx!.agentB);
    const noAttachment = await comment(ctx.taskId!, ctx.fx!.agentB, { type: "delivery", body: "No file" });
    assert.equal(noAttachment.status, 400);
    const notWorker = await comment(ctx.taskId!, ctx.fx!.agentC, {
      type: "delivery", body: "Not mine", attachment: "https://storage.zedu.test/x.md",
    });
    assert.equal(notWorker.status, 403);
    await deliver(ctx.taskId!, ctx.fx!.agentB, "https://storage.zedu.test/v1.md");
    assert.equal((await taskFromWorkstream(ctx.taskId!)).status, "submitted");
  });

  it("step 5 — the worker, people and other projects can't review", async () => {
    const own = await comment(ctx.taskId!, ctx.fx!.agentB, { type: "review", verdict: "approve", body: "Mine" });
    assert.equal(own.status, 403);
    const outsider = await comment(ctx.taskId!, ctx.fx!.outsider, { type: "review", verdict: "approve", body: "Hi" });
    assert.equal(outsider.status, 404);
    const person = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      body: { type: "review", verdict: "approve", body: "Looks fine" },
    });
    assert.equal(person.status, 403);
    const note = await call("POST", `/api/tasks/${ctx.taskId}/comments`, { body: { type: "note", body: "Thanks!" } });
    assert.equal(note.status, 201, errorText(note));
  });

  it("step 6 — two change verdicts send the task back to the worker", async () => {
    const first = await review(ctx.taskId!, ctx.fx!.agentC, "changes");
    assert.equal((await taskFromWorkstream(ctx.taskId!)).status, "in_review");
    const again = await comment(ctx.taskId!, ctx.fx!.agentC, { type: "review", verdict: "changes", body: "Again" });
    assert.equal(again.status, 409);
    await review(ctx.taskId!, ctx.fx!.agentD, "changes");
    const task = await taskFromWorkstream(ctx.taskId!);
    assert.equal(task.status, "changes_requested");
    assert.equal(task.revisionCount, 1);

    const pay = await ledger(`review:${first.id}`);
    assert.equal(pay?.userId, ctx.fx!.agentC.ownerId, "each review pays its reviewer's owner");
    assert.equal(Number(pay?.amount), 5);

    const inbox = await call("GET", "/api/me/inbox", { agent: ctx.fx!.agentB });
    assert.equal(inbox.status, 200, errorText(inbox));
    const revision = (asObject(inbox).revisions as Json[]).find((r) => (r.task as Json).id === ctx.taskId);
    assert.equal((revision?.changeReviews as Json[]).length, 2);
  });

  it("step 7 — after re-delivery, two approvals approve the task and pay the worker's owner", async () => {
    await deliver(ctx.taskId!, ctx.fx!.agentB, "https://storage.zedu.test/v2.md");
    const view = await call("GET", `/api/agent/tasks/${ctx.taskId}`, { agent: ctx.fx!.agentC });
    assert.equal(view.status, 200, errorText(view));
    const reviewerView = asObject(view);
    assert.equal(reviewerView.deliveryRound, 2);
    assert.equal((reviewerView.currentDelivery as Json).attachment, "https://storage.zedu.test/v2.md", "reviewers see the new delivery");
    assert.equal((reviewerView.changesToCheck as Json[]).length, 2, "and the changes it was meant to fix");
    assert.equal(reviewerView.canReview, true, "a reviewer of the old delivery can review the new one");
    await review(ctx.taskId!, ctx.fx!.agentC, "approve");
    await review(ctx.taskId!, ctx.fx!.agentD, "approve");
    const task = await taskFromWorkstream(ctx.taskId!);
    assert.equal(task.status, "approved");

    const late = await comment(ctx.taskId!, ctx.fx!.agentE, { type: "review", verdict: "approve", body: "Late" });
    assert.equal(late.status, 400, "an approved task takes no more reviews");

    const payout = await ledger(`task:${ctx.taskId}`);
    assert.equal(payout?.userId, ctx.fx!.agentB.ownerId);
    assert.equal(payout?.agentId, ctx.fx!.agentB.id);
    assert.equal(Number(payout?.amount), 40, "the content task type's points");
    assert.equal(payout?.projectId, ctx.fx!.projectId);

    const scoreboard = await call("GET", "/api/scoreboard");
    assert.equal(scoreboard.status, 200, errorText(scoreboard));
    const row = (asObject(scoreboard).rows as Json[]).find((r) => r.user_id === ctx.fx!.agentB.ownerId);
    assert.equal(row?.points, 40.5, "the task payout plus half a point for an upvote");

    const me = await call("GET", "/api/agent/me", { agent: ctx.fx!.agentB });
    assert.equal(me.status, 200, errorText(me));
    const points = asObject(me).points as { you: Json; owner: Json };
    assert.deepEqual(points.you, { total: 40.5, thisWeek: 40.5 }, "the agent sees what it earned");
    assert.deepEqual(points.owner, { total: 40.5, thisWeek: 40.5 }, "and its owner's points");
  });

  it("threads replies under the comment they answer", async () => {
    const thread = await call("GET", `/api/tasks/${ctx.taskId}/comments`);
    assert.equal(thread.status, 200, errorText(thread));
    const reviewId = (thread.body as Json[]).find((c) => c.type === "review")?.id as string;

    const answer = await comment(ctx.taskId!, ctx.fx!.agentB, { type: "note", parentId: reviewId, body: "Fixed in v2." });
    assert.equal(answer.status, 201, errorText(answer));
    const followUp = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      body: { parentId: asObject(answer).id, body: "Thanks, confirmed." },
    });
    assert.equal(followUp.status, 201, errorText(followUp));
    assert.equal(asObject(followUp).parentId, reviewId, "a reply to a reply joins the top-level comment");
  });
});

describe("edge case: two failed revision rounds reopen the task", () => {
  it("unassigns the worker on the third change round and takes new bids", async () => {
    const taskId = await createTask(`E2E Revision Task ${RUN_ID}`);
    await bidOfferAccept(taskId, ctx.fx!.agentE);

    for (let round = 1; round <= 3; round++) {
      await deliver(taskId, ctx.fx!.agentE, `https://storage.zedu.test/revision-v${round}.md`);
      await review(taskId, ctx.fx!.agentC, "changes");
      await review(taskId, ctx.fx!.agentD, "changes");
      const task = await taskFromWorkstream(taskId);
      if (round < 3) {
        assert.equal(task.status, "changes_requested");
        assert.equal(task.revisionCount, round);
        assert.equal(task.assignedAgentId, ctx.fx!.agentE.id, "worker keeps the task within the limit");
      } else {
        assert.equal(task.status, "reopened");
        assert.equal(task.assignedAgentId, null);
        assert.equal(task.revisionCount, 0);
      }
    }

    const rebid = await comment(taskId, ctx.fx!.agentC, { type: "bid", body: "New bidder after reopen" });
    assert.equal(rebid.status, 201, errorText(rebid));
    assert.equal((await taskFromWorkstream(taskId)).status, "bidding");
  });
});

describe("edge case: the offered agent declines", () => {
  it("clears the offer, posts the reason, and lets the owner offer it to someone else", async () => {
    const taskId = await createTask(`E2E Declined Task ${RUN_ID}`);
    for (const bidder of [ctx.fx!.agentC, ctx.fx!.agentD]) {
      const bid = await comment(taskId, bidder, { type: "bid", body: "I can do this" });
      assert.equal(bid.status, 201, errorText(bid));
    }
    const offer = await call("POST", `/api/tasks/${taskId}/offer`, { body: { agentId: ctx.fx!.agentC.id } });
    assert.equal(offer.status, 200, errorText(offer));

    const decline = (agent?: Actor, body?: Json) => call("POST", `/api/tasks/${taskId}/decline-offer`, { agent, body });
    assert.equal((await decline()).status, 403, "people can't decline for an agent");
    assert.equal((await decline(ctx.fx!.agentD)).status, 400, "only the offered agent can decline");
    assert.equal((await decline(ctx.fx!.outsider)).status, 404);

    const reason = "I already hold two active tasks.";
    const declined = await decline(ctx.fx!.agentC, { reason });
    assert.equal(declined.status, 200, errorText(declined));
    assert.equal(asObject(declined).offeredToAgentId, null);
    assert.equal(asObject(declined).status, "bidding");
    assert.equal((await decline(ctx.fx!.agentC)).status, 400, "nothing left to decline");

    const thread = await call("GET", `/api/tasks/${taskId}/comments`);
    const note = (thread.body as Json[]).find((c) => c.title === "Declined the offer");
    assert.equal(note?.body, reason);
    assert.equal(note?.authorAgentId, ctx.fx!.agentC.id);

    const next = await call("POST", `/api/tasks/${taskId}/offer`, { body: { agentId: ctx.fx!.agentD.id } });
    assert.equal(next.status, 200, errorText(next));
  });
});

describe("edge case: 24h offer expiration", () => {
  it("rejects a late accept-offer and the inbox sweep reopens the task for bidding", async () => {
    const taskId = await createTask(`E2E Expiry Task ${RUN_ID}`);
    await comment(taskId, ctx.fx!.agentD, { type: "bid", body: "Bid before expiry test" });
    const offer = await call("POST", `/api/tasks/${taskId}/offer`, { body: { agentId: ctx.fx!.agentD.id } });
    assert.equal(offer.status, 200, errorText(offer));

    // Simulate the 24h window elapsing.
    await ctx.prisma!.task.update({
      where: { id: taskId },
      data: { offerExpiresAt: new Date(Date.now() - 60_000), offeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const late = await call("POST", `/api/tasks/${taskId}/accept-offer`, { agent: ctx.fx!.agentD, body: {} });
    assert.equal(late.status, 400, errorText(late));
    assert.match(errorText(late), /expired/i);

    const inbox = await call("GET", "/api/me/inbox", { agent: ctx.fx!.agentD });
    assert.equal(inbox.status, 200, errorText(inbox));
    assert.ok(Number(asObject(inbox).expiredOffers) >= 1, "inbox reports the expired offer it swept");

    const task = await taskFromWorkstream(taskId);
    assert.equal(task.status, "bidding");
    assert.equal(task.offeredToAgentId, null);
  });
});

describe("edge case: agents can hold at most 2 active tasks", () => {
  it("blocks the third concurrent accept-offer", async () => {
    await bidOfferAccept(await createTask(`E2E Limit Task 1 ${RUN_ID}`), ctx.fx!.agentA);
    await bidOfferAccept(await createTask(`E2E Limit Task 2 ${RUN_ID}`), ctx.fx!.agentA);

    const third = await createTask(`E2E Limit Task 3 ${RUN_ID}`);
    await comment(third, ctx.fx!.agentA, { type: "bid", body: "Bid for third" });
    const offer = await call("POST", `/api/tasks/${third}/offer`, { body: { agentId: ctx.fx!.agentA.id } });
    assert.equal(offer.status, 400, "the goal owner can't offer past the active-task limit");
    assert.match(errorText(offer), /2 active/i);
  });
});

describe("task offer permissions: project admin vs non-admin member", () => {
  it("allows a project admin to send and withdraw offers while blocking non-admin members", async () => {
    const taskId = await createTask(`E2E Admin Offer Task ${RUN_ID}`);
    const bid = await comment(taskId, ctx.fx!.agentD, { type: "bid", body: "I want this task" });
    assert.equal(bid.status, 201, errorText(bid));

    // A regular member who did not create the goal cannot send offers
    const forbiddenOffer = await call("POST", `/api/tasks/${taskId}/offer`, {
      sessionToken: ctx.fx!.member.sessionToken,
      body: { agentId: ctx.fx!.agentD.id },
    });
    assert.equal(forbiddenOffer.status, 403);
    assert.match(errorText(forbiddenOffer), /Only the goal owner or a project admin can send offers/);

    // A project admin who did not create the goal CAN send an offer
    const adminOffer = await call("POST", `/api/tasks/${taskId}/offer`, {
      sessionToken: ctx.fx!.admin.sessionToken,
      body: { agentId: ctx.fx!.agentD.id },
    });
    assert.equal(adminOffer.status, 200, errorText(adminOffer));
    assert.equal(asObject(adminOffer).offeredToAgentId, ctx.fx!.agentD.id);

    // A regular member cannot withdraw the offer
    const forbiddenWithdraw = await call("DELETE", `/api/tasks/${taskId}/offer`, {
      sessionToken: ctx.fx!.member.sessionToken,
    });
    assert.equal(forbiddenWithdraw.status, 403);
    assert.match(errorText(forbiddenWithdraw), /Only the goal owner or a project admin can withdraw offers/);

    // A project admin CAN withdraw the offer
    const adminWithdraw = await call("DELETE", `/api/tasks/${taskId}/offer`, {
      sessionToken: ctx.fx!.admin.sessionToken,
    });
    assert.equal(adminWithdraw.status, 200, errorText(adminWithdraw));
    assert.equal(asObject(adminWithdraw).offeredToAgentId, null);
  });
});
