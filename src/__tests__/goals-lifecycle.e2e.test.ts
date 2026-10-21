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

function taskkillTree(pid: number): Promise<void> {
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
 * Task 5.1 — Full lifecycle integration suite (GOALS_TASKLIST.md).
 *
 * Boots a disposable PostgreSQL (embedded-postgres) plus `next dev`, then drives the
 * real HTTP API through: goal → idea → workstream → task → accept → bid → offer →
 * accept-offer → delivery → peer review → revision → re-delivery → approval, plus the
 * edge cases: self-review rejected, 2-revision limit unassigns the worker, and 24h
 * offer expiration.
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
const STEP_TIMEOUT_MS = 60_000;

type Json = Record<string, unknown>;

interface ApiResult {
  status: number;
  body: Json | Json[] | null;
}

interface Actor {
  key: string;
  id: string;
}

interface Fixtures {
  coordinator: { id: string; sessionToken: string };
  agentA: Actor; // proposer (ideas + tasks)
  agentB: Actor; // worker
  agentC: Actor; // peer reviewer / rebidder
  agentD: Actor; // extra bidder for the review cap
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
  assert.ok(ctx.fx, "fixtures ready");
  return {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`,
    NEXTAUTH_URL: APP_BASE,
    PORT: String(APP_PORT),
    NODE_ENV: "development" as const,
    REVIEW_COORDINATOR_USER_IDS: ctx.fx.coordinator.id,
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
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`prisma ${args.join(" ")} exited ${code}:\n${output}`));
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

async function call(
  method: string,
  pathAndQuery: string,
  options: { body?: unknown; as?: "coordinator" | "agent" } = {},
): Promise<ApiResult> {
  const fx = ctx.fx;
  assert.ok(fx, "fixtures ready");
  const headers: Record<string, string> = {};
  if (options.as === "agent") {
    const agent = currentAgent();
    assert.ok(agent, "an agent is selected");
    headers["x-agent-key"] = agent.key;
  } else {
    headers["cookie"] = `next-auth.session-token=${fx.coordinator.sessionToken}`;
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

let activeAgent: Actor | null = null;
function asAgent(actor: Actor) {
  activeAgent = actor;
  return { as: "agent" as const };
}
function asCoordinator() {
  activeAgent = null;
  return { as: "coordinator" as const };
}
function currentAgent() {
  return activeAgent;
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
  const res = await call("GET", `/api/workstreams/${ctx.workstreamId}`, asCoordinator());
  assert.equal(res.status, 200);
  const body = asObject(res);
  const tasks = body.tasks as Json[];
  const task = tasks.find((t) => t.id === taskId);
  assert.ok(task, `task ${taskId} listed in workstream`);
  return task;
}

async function proposeOpenTask(title: string): Promise<string> {
  const proposed = await call(
    "POST",
    `/api/workstreams/${ctx.workstreamId}/tasks`,
    { ...asAgent(ctx.fx!.agentA), body: { title, taskType: "content" } },
  );
  assert.equal(proposed.status, 201, errorText(proposed));
  const accepted = await call("POST", `/api/tasks/${(asObject(proposed) as Json).id}/accept`, asCoordinator());
  assert.equal(accepted.status, 200, errorText(accepted));
  return (asObject(proposed) as Json).id as string;
}

async function bidOfferAccept(taskId: string, worker: Actor) {
  const bid = await call("POST", `/api/tasks/${taskId}/comments`, {
    ...asAgent(worker),
    body: { type: "bid", body: `Bidding for ${taskId}` },
  });
  assert.equal(bid.status, 201, errorText(bid));
  const offer = await call("POST", `/api/tasks/${taskId}/offer`, {
    ...asCoordinator(),
    body: { agentId: worker.id },
  });
  assert.equal(offer.status, 200, errorText(offer));
  const accept = await call("POST", `/api/tasks/${taskId}/accept-offer`, {
    ...asAgent(worker),
    body: {},
  });
  assert.equal(accept.status, 200, errorText(accept));
  assert.equal(asObject(accept).status, "in_progress");
}

async function deliver(taskId: string, worker: Actor, attachment: string) {
  const res = await call("POST", `/api/tasks/${taskId}/comments`, {
    ...asAgent(worker),
    body: { type: "delivery", tag: "blog", title: "Delivery", body: "See attachment.", attachment },
  });
  assert.equal(res.status, 201, errorText(res));
  return asObject(res);
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
    }

    if (process.env.TEST_DATABASE_URL) {
      // The external database must already have the schema applied (e.g. a migrated dev database).
      await runPrismaCli(["migrate", "deploy"], { databaseUrl });
    } else {
      await provisionFreshDatabase(databaseUrl);
    }

    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = await import("@/lib/prisma");
    const { hashAgentKey: libHash } = await import("@/lib/agents");
    ctx.prisma = prisma;

    const email = (label: string) => `lifecycle-${label}-${RUN_ID}@test.local`;
    const mkUser = (label: string) =>
      prisma.user.create({ data: { email: email(label), name: `E2E ${label}` } });

    const coordinatorUser = await mkUser("coordinator");
    const ownerB = await mkUser("owner-b");
    const ownerC = await mkUser("owner-c");
    const ownerD = await mkUser("owner-d");

    const sessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        sessionToken,
        userId: coordinatorUser.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const mkAgent = async (label: string, name: string, speciality: string, ownerId: string) => {
      const key = `zedu_ak_e2e_${label}_${randomBytes(8).toString("hex")}`;
      const agent = await prisma.agent.create({
        data: {
          name,
          speciality,
          ownerId,
          keyHash: libHash(key),
          keyHint: "e2e",
        },
      });
      return { key, id: agent.id };
    };

    ctx.fx = {
      coordinator: { id: coordinatorUser.id, sessionToken },
      agentA: await mkAgent("a", "E2E Proposer", "seo", coordinatorUser.id),
      agentB: await mkAgent("b", "E2E Worker", "content", ownerB.id),
      agentC: await mkAgent("c", "E2E Reviewer", "research", ownerC.id),
      agentD: await mkAgent("d", "E2E Reviewer Two", "press", ownerD.id),
    };

    const server = spawn(
      process.execPath,
      [path.join("node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(APP_PORT)],
      { env: serverEnv(), stdio: ["ignore", "pipe", "pipe"] },
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
      if (prisma && ctx.fx) {
        // Deleting the goal cascades to workstreams, tasks and comments.
        if (ctx.goalId) await prisma.goal.deleteMany({ where: { id: ctx.goalId } });
        const agentIds = [ctx.fx.agentA.id, ctx.fx.agentB.id, ctx.fx.agentC.id, ctx.fx.agentD.id];
        await prisma.taskComment.deleteMany({ where: { authorAgentId: { in: agentIds } } });
        await prisma.task.deleteMany({ where: { assignedAgentId: { in: agentIds } } });
        await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
        await prisma.session.deleteMany({ where: { userId: ctx.fx.coordinator.id } });
        const orphanOwners = await prisma.user.findMany({
          where: { email: { contains: `-${RUN_ID}@test.local` } },
          select: { id: true },
        });
        await prisma.user.deleteMany({
          where: { id: { in: [ctx.fx.coordinator.id, ...orphanOwners.map((u) => u.id)] } },
        });
      }
    } finally {
      if (server?.pid) await taskkillTree(server.pid);
      // pg_ctl / SIGTERM cannot always reach the postmaster on Windows; force-kill the
      // recorded postmaster PID before removing its data directory.
      const pidFile = path.join(PG_DATA_DIR, "postmaster.pid");
      if (existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0].trim());
        if (Number.isInteger(pid) && pid > 0) await taskkillTree(pid);
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

describe("Task 5.1 — full lifecycle: goal → idea → workstream → task → bidding → delivery → review → revision → approval", () => {
  it("blocks agents from creating top-level goals", async () => {
    const res = await call("POST", "/api/goals", {
      ...asAgent(ctx.fx!.agentA),
      body: { title: "Agent goal", type: "seo" },
    });
    assert.equal(res.status, 403);
  });

  it("step 1 — human creates a goal", async () => {
    const res = await call("POST", "/api/goals", {
      ...asCoordinator(),
      body: { title: `E2E Lifecycle Goal ${RUN_ID}`, description: "Integration test goal", type: "seo" },
    });
    assert.equal(res.status, 201, errorText(res));
    const goal = asObject(res);
    assert.equal(goal.type, "seo");
    assert.equal(goal.status, "active");
    ctx.goalId = goal.id as string;
  });

  it("rejects goals with an invalid type", async () => {
    const res = await call("POST", "/api/goals", {
      ...asCoordinator(),
      body: { title: "Bad type goal", type: "not-a-type" },
    });
    assert.equal(res.status, 400);
  });

  it("step 2 — agent proposes an idea under the goal", async () => {
    const res = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: `E2E Idea ${RUN_ID}`, description: "Proposed by agent A" },
    });
    assert.equal(res.status, 201, errorText(res));
    const idea = asObject(res);
    assert.equal(idea.status, "proposed");
    assert.equal(idea.proposedByAgentId, ctx.fx!.agentA.id);
    ctx.workstreamId = idea.id as string;

    const duplicate = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: `E2E Idea ${RUN_ID}` },
    });
    assert.equal(duplicate.status, 409, "duplicate idea title under the same goal");
  });

  it("rejects task proposals under an unaccepted idea", async () => {
    const idea = await call("POST", `/api/goals/${ctx.goalId}/ideas`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: `E2E Unaccepted Idea ${RUN_ID}` },
    });
    assert.equal(idea.status, 201, errorText(idea));
    const res = await call("POST", `/api/workstreams/${(asObject(idea) as Json).id}/tasks`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: "Should not be creatable", taskType: "content" },
    });
    assert.equal(res.status, 400);
    assert.match(errorText(res), /unaccepted idea/i);
  });

  it("step 3 — human accepts the idea, becoming a workstream", async () => {
    const res = await call("POST", `/api/ideas/${ctx.workstreamId}/accept`, asCoordinator());
    assert.equal(res.status, 200, errorText(res));
    const ws = asObject(res);
    assert.equal(ws.status, "accepted");
    assert.equal(ws.acceptedById, ctx.fx!.coordinator.id);
  });

  it("step 4 — agent proposes a task and the human accepts it to `open`", async () => {
    const res = await call("POST", `/api/workstreams/${ctx.workstreamId}/tasks`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: `E2E Task ${RUN_ID}`, description: "Audit blog posts", taskType: "content" },
    });
    assert.equal(res.status, 201, errorText(res));
    const task = asObject(res);
    assert.equal(task.status, "proposed", "manual workstreams start tasks as proposed");
    ctx.taskId = task.id as string;

    const accepted = await call("POST", `/api/tasks/${ctx.taskId}/accept`, asCoordinator());
    assert.equal(accepted.status, 200, errorText(accepted));
    assert.equal(asObject(accepted).status, "open");

    const again = await call("POST", `/api/tasks/${ctx.taskId}/accept`, asCoordinator());
    assert.equal(again.status, 400, "a task can only be accepted from proposed");
  });

  it("auto-accept workstreams open tasks immediately", async () => {
    const toggle = await call("PATCH", `/api/workstreams/${ctx.workstreamId}/auto-accept`, {
      ...asCoordinator(),
      body: { autoAcceptTasks: true },
    });
    assert.equal(toggle.status, 200, errorText(toggle));

    const res = await call("POST", `/api/workstreams/${ctx.workstreamId}/tasks`, {
      ...asAgent(ctx.fx!.agentA),
      body: { title: `E2E Auto Task ${RUN_ID}`, taskType: "seo" },
    });
    assert.equal(res.status, 201, errorText(res));
    assert.equal(asObject(res).status, "open");

    await call("PATCH", `/api/workstreams/${ctx.workstreamId}/auto-accept`, {
      ...asCoordinator(),
      body: { autoAcceptTasks: false },
    });
  });

  it("step 5 — agent bids, human offers, agent accepts → in_progress", async () => {
    const bid = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "bid", body: "I can deliver this audit in a day." },
    });
    assert.equal(bid.status, 201, errorText(bid));
    assert.equal((await taskFromWorkstream(ctx.taskId!)).status, "bidding");

    const offer = await call("POST", `/api/tasks/${ctx.taskId}/offer`, {
      ...asCoordinator(),
      body: { agentId: ctx.fx!.agentB.id },
    });
    assert.equal(offer.status, 200, errorText(offer));
    const offered = asObject(offer);
    assert.equal(offered.offeredToAgentId, ctx.fx!.agentB.id);
    assert.equal(offered.status, "bidding");
    assert.ok(offered.offerExpiresAt, "offer carries an expiry timestamp");

    const wrongAgent = await call("POST", `/api/tasks/${ctx.taskId}/accept-offer`, {
      ...asAgent(ctx.fx!.agentC),
      body: {},
    });
    assert.equal(wrongAgent.status, 400, "only the offered agent can accept the offer");

    const accept = await call("POST", `/api/tasks/${ctx.taskId}/accept-offer`, {
      ...asAgent(ctx.fx!.agentB),
      body: {},
    });
    assert.equal(accept.status, 200, errorText(accept));
    assert.equal(asObject(accept).status, "in_progress");
  });

  it("step 6 — only the assigned worker can deliver, and deliveries require an attachment", async () => {
    const byPeer = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentC),
      body: { type: "delivery", body: "Sneaky delivery", attachment: "https://example.com/x.md" },
    });
    assert.equal(byPeer.status, 403, errorText(byPeer));

    const noAttachment = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "delivery", body: "Missing attachment" },
    });
    assert.equal(noAttachment.status, 400, errorText(noAttachment));

    const delivery = await deliver(ctx.taskId!, ctx.fx!.agentB, "https://storage.zedu.test/audit-v1.md");
    assert.equal(delivery.attachment, "https://storage.zedu.test/audit-v1.md");
    assert.equal(delivery.body, "See attachment.", "deliverable content stays out of the chatter body");
    assert.equal((await taskFromWorkstream(ctx.taskId!)).status, "submitted");
  });

  it("step 7 — peer review with score; the worker cannot review their own delivery", async () => {
    const self = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "review", body: "Self review", score: 10 },
    });
    assert.equal(self.status, 403, errorText(self));

    const review = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentC),
      body: { type: "review", title: "Solid audit", body: "Accurate, minor gaps.", score: 8 },
    });
    assert.equal(review.status, 201, errorText(review));
    assert.equal(asObject(review).score, 8);
  });

  it("step 7b — at most 4 peer reviews per delivery round", async () => {
    for (const agent of [ctx.fx!.agentC, ctx.fx!.agentD, ctx.fx!.agentC]) {
      const res = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
        ...asAgent(agent),
        body: { type: "review", body: `Round review by ${agent.id}` },
      });
      assert.equal(res.status, 201, errorText(res));
    }
    const fifth = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentD),
      body: { type: "review", body: "Fifth review should be blocked" },
    });
    assert.equal(fifth.status, 400, errorText(fifth));
    assert.match(errorText(fifth), /maximum 4/i);
  });

  it("step 8 — review coordinator requests a revision (round 1)", async () => {
    const res = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asCoordinator(),
      body: { type: "revision_request", title: "Add canonical tags", body: "Cover dynamic routes too." },
    });
    assert.equal(res.status, 201, errorText(res));
    const task = await taskFromWorkstream(ctx.taskId!);
    assert.equal(task.status, "changes_requested");
    assert.equal(task.revisionCount, 1);
  });

  it("step 9 — the worker delivers revised work", async () => {
    await deliver(ctx.taskId!, ctx.fx!.agentB, "https://storage.zedu.test/audit-v2.md");
    const task = await taskFromWorkstream(ctx.taskId!);
    assert.equal(task.status, "submitted");
    assert.equal(task.revisionCount, 1, "delivery keeps the revision count");
  });

  it("peer reviewer from a different owner can also request revisions", async () => {
    const res = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentC),
      body: { type: "revision_request", title: "Nitpick", body: "One more pass on slugs please." },
    });
    assert.equal(res.status, 201, errorText(res));
    const task = await taskFromWorkstream(ctx.taskId!);
    assert.equal(task.status, "changes_requested");
    assert.equal(task.revisionCount, 2);

    // Worker (same agent) cannot request a revision on their own task.
    const workerSelf = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "revision_request", title: "Self revision", body: "Should be blocked" },
    });
    assert.equal(workerSelf.status, 403, errorText(workerSelf));

    await deliver(ctx.taskId!, ctx.fx!.agentB, "https://storage.zedu.test/audit-v3.md");
  });

  it("step 10 — review coordinator approves → task approved and locked", async () => {
    const review = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentC),
      body: { type: "review", body: "Round 2 review passes", score: 9 },
    });
    assert.equal(review.status, 201, errorText(review));

    const res = await call("POST", `/api/tasks/${ctx.taskId}/approve`, {
      ...asCoordinator(),
      body: { title: "Final Sign-Off", body: "Ship it.", tag: "seo" },
    });
    assert.equal(res.status, 200, errorText(res));
    const approved = asObject(res);
    assert.equal(approved.status, "approved");
    assert.equal(approved.done, true);
    const comment = approved.comment as Json;
    assert.equal(comment.type, "approval");
    assert.equal(comment.authorUserId, ctx.fx!.coordinator.id);

    const locked = await call("POST", `/api/tasks/${ctx.taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "delivery", body: "Late delivery", attachment: "https://example.com/late.md" },
    });
    assert.equal(locked.status, 400, "approved tasks reject further deliveries");

    const again = await call("POST", `/api/tasks/${ctx.taskId}/approve`, asCoordinator());
    assert.equal(again.status, 400, "approved tasks cannot be approved twice");
  });
});

describe("Task 5.1 — edge case: 24h offer expiration", () => {
  it("rejects a late accept-offer and the inbox sweep reopens the task for bidding", async () => {
    const taskId = await proposeOpenTask(`E2E Expiry Task ${RUN_ID}`);
    await call("POST", `/api/tasks/${taskId}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "bid", body: "Bid before expiry test" },
    });
    const offer = await call("POST", `/api/tasks/${taskId}/offer`, {
      ...asCoordinator(),
      body: { agentId: ctx.fx!.agentB.id },
    });
    assert.equal(offer.status, 200, errorText(offer));

    // Simulate the 24h window elapsing.
    await ctx.prisma!.task.update({
      where: { id: taskId },
      data: { offerExpiresAt: new Date(Date.now() - 60_000), offeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const late = await call("POST", `/api/tasks/${taskId}/accept-offer`, {
      ...asAgent(ctx.fx!.agentB),
      body: {},
    });
    assert.equal(late.status, 400, errorText(late));
    assert.match(errorText(late), /expired/i);

    const inbox = await call("GET", "/api/me/inbox", asAgent(ctx.fx!.agentB));
    assert.equal(inbox.status, 200, errorText(inbox));
    const body = asObject(inbox);
    assert.equal((body.agent as Json).id, ctx.fx!.agentB.id);
    assert.ok(Number(body.expiredOffers) >= 1, "inbox reports the expired offer it swept");
    const offers = body.offers as Json[];
    assert.ok(
      offers.every((o) => ((o as { task: Json }).task as Json).id !== taskId),
      "expired task is no longer offered to the agent",
    );

    const task = await taskFromWorkstream(taskId);
    assert.equal(task.status, "bidding");
    assert.equal(task.offeredToAgentId, null);
    assert.equal(task.offerExpiresAt, null);
  });
});

describe("Task 5.1 — edge case: agents can hold at most 2 active in-progress tasks", () => {
  it("blocks the third concurrent accept-offer", async () => {
    const first = await proposeOpenTask(`E2E Limit Task 1 ${RUN_ID}`);
    await bidOfferAccept(first, ctx.fx!.agentB);
    const second = await proposeOpenTask(`E2E Limit Task 2 ${RUN_ID}`);
    await bidOfferAccept(second, ctx.fx!.agentB);

    const third = await proposeOpenTask(`E2E Limit Task 3 ${RUN_ID}`);
    await call("POST", `/api/tasks/${third}/comments`, {
      ...asAgent(ctx.fx!.agentB),
      body: { type: "bid", body: "Bid for third" },
    });
    await call("POST", `/api/tasks/${third}/offer`, {
      ...asCoordinator(),
      body: { agentId: ctx.fx!.agentB.id },
    });
    const blocked = await call("POST", `/api/tasks/${third}/accept-offer`, {
      ...asAgent(ctx.fx!.agentB),
      body: {},
    });
    assert.equal(blocked.status, 400, errorText(blocked));
    assert.match(errorText(blocked), /2 active/i);
  });
});

describe("Task 5.1 — edge case: the 3rd revision request unassigns the worker and reopens bidding", () => {
  it("caps revisions at 2 rounds, then resets and reopens for new bidders", async () => {
    const taskId = await proposeOpenTask(`E2E Revision Task ${RUN_ID}`);
    // Agent B already holds two in-progress tasks from the concurrency-limit test above,
    // so this cycle runs on agent D; agent C takes over after the reopen.
    await bidOfferAccept(taskId, ctx.fx!.agentD);

    for (let round = 1; round <= 2; round++) {
      await deliver(taskId, ctx.fx!.agentD, `https://storage.zedu.test/revision-v${round}.md`);
      const revision = await call("POST", `/api/tasks/${taskId}/comments`, {
        ...asCoordinator(),
        body: { type: "revision_request", title: `Round ${round}`, body: "More work needed" },
      });
      assert.equal(revision.status, 201, errorText(revision));
      const task = await taskFromWorkstream(taskId);
      assert.equal(task.status, "changes_requested");
      assert.equal(task.revisionCount, round);
      assert.equal(task.assignedAgentId, ctx.fx!.agentD.id, "worker keeps the task within the limit");
    }

    await deliver(taskId, ctx.fx!.agentD, "https://storage.zedu.test/revision-v3.md");
    const third = await call("POST", `/api/tasks/${taskId}/comments`, {
      ...asCoordinator(),
      body: { type: "revision_request", title: "Round 3", body: "Still not there" },
    });
    assert.equal(third.status, 201, errorText(third));
    const reopened = await taskFromWorkstream(taskId);
    assert.equal(reopened.status, "reopened");
    assert.equal(reopened.assignedAgentId, null, "worker is unassigned after the limit");
    assert.equal(reopened.revisionCount, 0, "revision count resets");

    const rebid = await call("POST", `/api/tasks/${taskId}/comments`, {
      ...asAgent(ctx.fx!.agentC),
      body: { type: "bid", body: "New bidder after reopen" },
    });
    assert.equal(rebid.status, 201, errorText(rebid));
    assert.equal((await taskFromWorkstream(taskId)).status, "bidding");

    const offer = await call("POST", `/api/tasks/${taskId}/offer`, {
      ...asCoordinator(),
      body: { agentId: ctx.fx!.agentC.id },
    });
    assert.equal(offer.status, 200, errorText(offer));
    const accept = await call("POST", `/api/tasks/${taskId}/accept-offer`, {
      ...asAgent(ctx.fx!.agentC),
      body: {},
    });
    assert.equal(accept.status, 200, errorText(accept));
    assert.equal(asObject(accept).status, "in_progress");
  });
});
