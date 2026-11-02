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

let APP_PORT = 0;
let APP_BASE = "";
let PG_PORT = 0;
const RUN_ID = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const PG_DATA_DIR = path.join(
  tmpdir(),
  `metric-tracker-search-e2e-pg-${RUN_ID}`,
);
const PG_DATA_DIR_PREFIX = "metric-tracker-search-e2e-pg-";
const DB_NAME = "metric_tracker_search_test";

const SETUP_TIMEOUT_MS = 240_000;

type Json = Record<string, unknown>;

interface ApiResult {
  status: number;
  body: Json | Json[] | null;
}

interface Fixtures {
  owner: { id: string; sessionToken: string };
  projectId1: string;
  projectId2: string;
  agentKey: string;
  outsiderSessionToken: string;
}

const ctx: {
  prisma?: import("@prisma/client").PrismaClient;
  pg?: EmbeddedPostgres;
  server?: ChildProcess;
  serverLog: string[];
  fx?: Fixtures;
} = { serverLog: [] };

function serverEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`,
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

function runPrismaCli(
  args: string[],
  options: { stdin?: string; databaseUrl?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = options.databaseUrl
      ? { ...process.env, DATABASE_URL: options.databaseUrl }
      : process.env;
    const child = spawn(
      process.execPath,
      [path.join("node_modules", "prisma", "build", "index.js"), ...args],
      { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (errors += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            `prisma ${args.join(" ")} exited ${code}:\n${output}${errors}`,
          ),
        );
    });
    if (options.stdin !== undefined) child.stdin.write(options.stdin);
    child.stdin.end();
  });
}

async function provisionFreshDatabase(databaseUrl: string): Promise<void> {
  const script = await runPrismaCli([
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ]);
  await runPrismaCli(["db", "execute", "--stdin"], {
    stdin: script,
    databaseUrl,
  });
  const triggerScript = `
CREATE OR REPLACE FUNCTION "amp_next_task_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."number" IS NOT NULL AND NEW."number" > 0 THEN
    RETURN NEW;
  END IF;
  UPDATE "Project" SET "lastTaskNumber" = "lastTaskNumber" + 1
  WHERE "id" = NEW."projectId"
  RETURNING "lastTaskNumber" INTO NEW."number";
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "Task_number" ON "Task";
CREATE TRIGGER "Task_number" BEFORE INSERT ON "Task" FOR EACH ROW EXECUTE FUNCTION "amp_next_task_number"();
`;
  await runPrismaCli(["db", "execute", "--stdin"], {
    stdin: triggerScript,
    databaseUrl,
  });
}

async function callApi(
  pathAndQuery: string,
  options: {
    sessionToken?: string;
    projectId?: string;
    agentKey?: string;
  } = {},
): Promise<ApiResult> {
  const fx = ctx.fx!;
  const headers: Record<string, string> = {};

  if (options.agentKey) {
    headers["x-agent-key"] = options.agentKey;
  } else {
    if (options.sessionToken) {
      headers["cookie"] = `next-auth.session-token=${options.sessionToken}`;
    }
    if (options.projectId) {
      headers["x-project-id"] = options.projectId;
    }
  }

  const res = await fetch(`${APP_BASE}${pathAndQuery}`, {
    method: "GET",
    headers,
  });

  let body: ApiResult["body"] = null;
  try {
    body = (await res.json()) as ApiResult["body"];
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

before(
  async () => {
    [APP_PORT, PG_PORT] = await Promise.all([getFreePort(), getFreePort()]);
    APP_BASE = `http://localhost:${APP_PORT}`;

    cleanStaleScratchDirs();

    const databaseUrl =
      process.env.TEST_DATABASE_URL ??
      `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`;

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
      if (existsSync(PG_DATA_DIR))
        rmSync(PG_DATA_DIR, { recursive: true, force: true });
      await pg.initialise();
      await pg.start();
      await pg.createDatabase(DB_NAME);
      await provisionFreshDatabase(databaseUrl);
    } else {
      await runPrismaCli(["migrate", "deploy"], { databaseUrl });
    }

    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = await import("@/lib/prisma");
    const { hashAgentKey } = await import("@/lib/agents");
    const { DEFAULT_POINT_RULES, DEFAULT_TASK_TYPES } =
      await import("@/lib/points");
    ctx.prisma = prisma;

    const mkUser = (label: string) =>
      prisma.user.create({
        data: {
          email: `search-e2e-${label}-${RUN_ID}@test.local`,
          name: `Search E2E ${label}`,
        },
      });

    const [owner, outsider, nonMember] = await Promise.all([
      mkUser("owner"),
      mkUser("outsider"),
      mkUser("nonmember"),
    ]);

    const createProject = (ownerId: string, name: string) =>
      prisma.project.create({
        data: {
          name,
          slug: `search-e2e-${randomBytes(6).toString("hex")}`,
          joinCode: randomBytes(4).toString("hex"),
          inviteToken: randomBytes(16).toString("hex"),
          createdById: ownerId,
          members: { create: { userId: ownerId, role: "owner" } },
          taskTypes: { create: DEFAULT_TASK_TYPES },
          pointRules: { create: DEFAULT_POINT_RULES },
        },
      });

    const project1 = await createProject(owner.id, `Project 1 ${RUN_ID}`);
    const project2 = await createProject(owner.id, `Project 2 ${RUN_ID}`);

    // Add outsider to project 2 only
    await prisma.projectMember.create({
      data: { userId: outsider.id, projectId: project2.id, role: "member" },
    });

    const sessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        sessionToken,
        userId: owner.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const outsiderSessionToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        sessionToken: outsiderSessionToken,
        userId: outsider.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const rawAgentKey = `zedu_ak_e2e_search_${randomBytes(8).toString("hex")}`;
    await prisma.agent.create({
      data: {
        name: "UniqueSearchKeyword Agent",
        speciality: "SEO Speciality",
        projectId: project1.id,
        ownerId: owner.id,
        keyHash: hashAgentKey(rawAgentKey),
        keyHint: "e2e",
      },
    });

    // Seed a task in each project (the agent above is in project 1 only)
    const seedData = async (pId: string) => {
      await prisma.task.create({
        data: {
          projectId: pId,
          title: "UniqueSearchKeyword Task",
          type: "Call",
        },
      });
    };

    await seedData(project1.id);
    await seedData(project2.id);

    ctx.fx = {
      owner: { id: owner.id, sessionToken },
      projectId1: project1.id,
      projectId2: project2.id,
      agentKey: rawAgentKey,
      outsiderSessionToken,
    };

    const server = spawn(
      process.execPath,
      [
        path.join("node_modules", "next", "dist", "bin", "next"),
        "dev",
        "-p",
        String(APP_PORT),
      ],
      {
        env: serverEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    ctx.server = server;
    server.stdout.on("data", (chunk: Buffer) => {
      ctx.serverLog.push(chunk.toString());
      if (ctx.serverLog.length > 200) ctx.serverLog.shift();
    });
    server.stderr.on("data", (chunk: Buffer) =>
      ctx.serverLog.push(chunk.toString()),
    );

    await waitForServer(SETUP_TIMEOUT_MS);
  },
  { timeout: SETUP_TIMEOUT_MS + 60_000 },
);

after(
  async () => {
    const { prisma, server, pg } = ctx;
    try {
      if (prisma && process.env.TEST_DATABASE_URL) {
        await prisma.project.deleteMany({
          where: { name: { contains: RUN_ID } },
        });
        await prisma.user.deleteMany({
          where: { email: { contains: `-${RUN_ID}@test.local` } },
        });
      }
    } finally {
      if (server?.pid) await killTree(server.pid);
      const pidFile = path.join(PG_DATA_DIR, "postmaster.pid");
      if (process.platform === "win32" && existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0].trim());
        if (Number.isInteger(pid) && pid > 0) await killTree(pid);
      }
      if (pg) {
        try {
          await Promise.race([
            pg.stop(),
            new Promise((resolve) => setTimeout(resolve, 5_000)),
          ]);
        } catch {
          // Already stopped.
        }
      }
      if (existsSync(PG_DATA_DIR))
        rmSync(PG_DATA_DIR, { recursive: true, force: true });
      await ctx.prisma?.$disconnect();
    }
  },
  { timeout: 120_000 },
);

describe("Global Search E2E Tests", () => {
  it("returns 401 when signed out", async () => {
    const res = await callApi("/api/search?q=UniqueSearchKeyword", {
      projectId: ctx.fx!.projectId1,
    });
    assert.equal(res.status, 401);
  });

  it("returns 403 when called with an agent key", async () => {
    const res = await callApi("/api/search?q=UniqueSearchKeyword", {
      agentKey: ctx.fx!.agentKey,
    });
    assert.equal(res.status, 403);
  });

  it("returns 404 when user is not a project member", async () => {
    // Outsider belongs to project 2, but tries to access project 1
    const res = await callApi("/api/search?q=UniqueSearchKeyword", {
      sessionToken: ctx.fx!.outsiderSessionToken,
      projectId: ctx.fx!.projectId1,
    });
    assert.equal(res.status, 404);
  });

  it("returns 400 for bad input (query too short)", async () => {
    const res = await callApi("/api/search?q=a", {
      sessionToken: ctx.fx!.owner.sessionToken,
      projectId: ctx.fx!.projectId1,
    });
    assert.equal(res.status, 400);
  });

  it("finds tasks and agents and respects project isolation", async () => {
    const res = await callApi("/api/search?q=UniqueSearchKeyword", {
      sessionToken: ctx.fx!.owner.sessionToken,
      projectId: ctx.fx!.projectId1,
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      query: string;
      results: Array<{ type: string; title: string; href: string }>;
    };
    assert.equal(body.query, "UniqueSearchKeyword");

    // Ensure both types are found in project 1
    const typesFound = new Set(body.results.map((r) => r.type));
    const expectedTypes = [
      "task",
      "agent",
    ];
    for (const t of expectedTypes) {
      assert.ok(typesFound.has(t), `expected type ${t} to be found`);
    }

    // Tasks link to their own page
    const task = body.results.find((r) => r.type === "task");
    assert.ok(task?.href.startsWith("/tasks/"), "task links to /tasks/<id>");
    assert.equal(body.results.filter((r) => r.type === "task").length, 1, "only this project's task");
  });

  it("does not match everything on a wildcard query like %", async () => {
    const res = await callApi("/api/search?q=%", {
      sessionToken: ctx.fx!.owner.sessionToken,
      projectId: ctx.fx!.projectId1,
    });
    // % is trimmed to 0 characters or doesn't meet length requirement (2 to 100 chars) -> 400 validation error
    assert.equal(res.status, 400);
  });

  it("respects the limit parameter", async () => {
    const res = await callApi("/api/search?q=UniqueSearchKeyword&limit=1", {
      sessionToken: ctx.fx!.owner.sessionToken,
      projectId: ctx.fx!.projectId1,
    });
    assert.equal(res.status, 200);
    const body = res.body as { results: Array<{ type: string }> };

    // Count occurrences per type
    const counts: Record<string, number> = {};
    for (const r of body.results) {
      counts[r.type] = (counts[r.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(counts)) {
      assert.ok(count <= 1, `type ${type} exceeded limit of 1 (got ${count})`);
    }
  });
});
