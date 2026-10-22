import test from "node:test";
import assert from "node:assert/strict";
import { exportDatabaseData, exportDatabaseSpreadsheet, type DbClient } from "@/lib/admin-export";
import { getOpenApiDocument } from "@/lib/openapi";

function createMockDb(): DbClient {
  const mockDate = new Date("2026-10-22T10:00:00.000Z");

  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === "user-admin") {
          return { id: "user-admin", name: "Admin User", email: "admin@example.com", isPlatformAdmin: false };
        }
        if (where.id === "user-platform-admin") {
          return { id: "user-platform-admin", name: "Root Admin", email: "root@example.com", isPlatformAdmin: true };
        }
        if (where.id === "user-member") {
          return { id: "user-member", name: "Normal Member", email: "member@example.com", isPlatformAdmin: false };
        }
        return null;
      },
      findMany: async () => [
        { id: "user-admin", name: "Admin User", email: "admin@example.com", image: null, isPlatformAdmin: false },
        { id: "user-worker", name: "Worker User", email: "worker@example.com", image: null, isPlatformAdmin: false },
      ],
    } as unknown as DbClient["user"],

    project: {
      findMany: async ({ where }: { where?: { id?: { in?: string[] } } }) => [
        {
          id: "proj-1",
          name: "Zedu Vulcan",
          slug: "zedu-vulcan",
          joinCode: "K7QX-3MPR",
          inviteToken: "token-123",
          createdById: "user-admin",
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["project"],

    projectMember: {
      findUnique: async ({ where }: { where: { projectId_userId: { projectId: string; userId: string } } }) => {
        if (where.projectId_userId.userId === "user-admin" && where.projectId_userId.projectId === "proj-1") {
          return { id: "pm-1", projectId: "proj-1", userId: "user-admin", role: "admin", joinedAt: mockDate };
        }
        if (where.projectId_userId.userId === "user-member" && where.projectId_userId.projectId === "proj-1") {
          return { id: "pm-2", projectId: "proj-1", userId: "user-member", role: "member", joinedAt: mockDate };
        }
        return null;
      },
      findMany: async () => [
        {
          id: "pm-1",
          projectId: "proj-1",
          userId: "user-admin",
          role: "admin",
          joinedAt: mockDate,
          user: { id: "user-admin", name: "Admin User", email: "admin@example.com", image: null, isPlatformAdmin: false },
        },
      ],
    } as unknown as DbClient["projectMember"],

    agent: {
      findMany: async () => [
        {
          id: "agent-1",
          projectId: "proj-1",
          name: "ResearchBot",
          speciality: "research",
          description: "Performs market research",
          avatarStyle: "bottts",
          avatarSeed: "seed1",
          ownerId: "user-admin",
          connectedAt: mockDate,
          lastActiveAt: mockDate,
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["agent"],

    pointsLedger: {
      findMany: async () => [
        {
          id: "pl-1",
          userId: "user-worker",
          agentId: "agent-1",
          projectId: "proj-1",
          amount: 50,
          reason: "task_approved",
          sourceType: "task",
          sourceId: "task-1",
          idempotencyKey: "idem-1",
          grantedByUserId: "user-admin",
          note: "Completed market research",
          createdAt: mockDate,
        },
        {
          id: "pl-2",
          userId: "user-admin",
          agentId: null,
          projectId: "proj-1",
          amount: 25,
          reason: "peer_review",
          sourceType: "task",
          sourceId: "task-1",
          idempotencyKey: "idem-2",
          grantedByUserId: null,
          note: "Review awarded",
          createdAt: mockDate,
        },
      ],
    } as unknown as DbClient["pointsLedger"],

    task: {
      findMany: async () => [
        {
          id: "task-1",
          projectId: "proj-1",
          workstreamId: "ws-1",
          taskType: "research",
          type: "Other",
          title: "Research Competitor Pricing",
          description: "Analyze top 5 competitors",
          status: "approved",
          assignedAgentId: "agent-1",
          offeredToAgentId: null,
          offeredAt: null,
          offerExpiresAt: null,
          revisionCount: 0,
          maxRevisions: 2,
          points: 50,
          dueAt: null,
          done: true,
          completedAt: mockDate,
          ownerId: null,
          userId: "user-admin",
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["task"],

    taskComment: {
      findMany: async () => [
        {
          id: "tc-1",
          taskId: "task-1",
          type: "delivery",
          tag: "research",
          title: "Deliverable Ready",
          body: "https://docs.google.com/spreadsheets/d/xxx",
          attachment: "https://docs.google.com/spreadsheets/d/xxx",
          score: null,
          verdict: null,
          parentId: null,
          authorAgentId: "agent-1",
          authorUserId: null,
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["taskComment"],

    taskTypeDef: {
      findMany: async () => [
        {
          id: "tt-1",
          projectId: "proj-1",
          slug: "research",
          name: "Market Research",
          description: "Detailed industry analysis",
          points: 50,
          maxPoints: 100,
          isActive: true,
          createdAt: mockDate,
          updatedAt: mockDate,
          updatedBy: "user-admin",
        },
      ],
    } as unknown as DbClient["taskTypeDef"],

    pointRule: {
      findMany: async () => [
        {
          projectId: "proj-1",
          ruleKey: "task_approved",
          amount: 50,
          enabled: true,
          weeklyCap: null,
        },
      ],
    } as unknown as DbClient["pointRule"],

    goal: {
      findMany: async () => [
        {
          id: "goal-1",
          projectId: "proj-1",
          title: "Q4 Marketing Push",
          description: "Reach 10,000 users",
          type: "marketing",
          status: "active",
          createdById: "user-admin",
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["goal"],

    workstream: {
      findMany: async () => [
        {
          id: "ws-1",
          goalId: "goal-1",
          title: "Competitor Analysis",
          description: "Evaluate competitive landscape",
          status: "accepted",
          autoAcceptTasks: false,
          proposedByAgentId: "agent-1",
          acceptedById: "user-admin",
          rejectionReason: null,
          upvotes: [],
          downvotes: [],
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ],
    } as unknown as DbClient["workstream"],

    contentItem: {
      findMany: async () => [],
    } as unknown as DbClient["contentItem"],

    directory: {
      findMany: async () => [],
    } as unknown as DbClient["directory"],

    pressOutlet: {
      findMany: async () => [],
    } as unknown as DbClient["pressOutlet"],

    pressCoverage: {
      findMany: async () => [],
    } as unknown as DbClient["pressCoverage"],

    pressSubmission: {
      findMany: async () => [],
    } as unknown as DbClient["pressSubmission"],
  };
}

test("exportDatabaseData: denies access if user is not found", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => exportDatabaseData(db, { userId: "user-unknown" }),
    /Unauthorized: User not found/
  );
});

test("exportDatabaseData: denies non-admin member from exporting a project", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => exportDatabaseData(db, { userId: "user-member", projectId: "proj-1" }),
    /Forbidden: Admin or owner role required for this project/
  );
});

test("exportDatabaseData: denies user with no admin memberships when no project is specified", async () => {
  const db = createMockDb();
  // Override projectMember.findMany to return empty for member
  (db.projectMember.findMany as unknown) = async () => [];

  await assert.rejects(
    () => exportDatabaseData(db, { userId: "user-member" }),
    /Forbidden: Admin or owner role required on at least one project/
  );
});

test("exportDatabaseData: successfully exports data for a project admin", async () => {
  const db = createMockDb();
  const backup = await exportDatabaseData(db, {
    userId: "user-admin",
    projectId: "proj-1",
  });

  assert.equal(backup.metadata.version, "1.0");
  assert.equal(backup.metadata.projectCount, 1);
  assert.equal(backup.metadata.exportedBy.id, "user-admin");

  // Check summary counts
  assert.equal(backup.summary.projectsCount, 1);
  assert.equal(backup.summary.pointsLedgerCount, 2);
  assert.equal(backup.summary.totalPointsAwarded, 75);
  assert.equal(backup.summary.tasksCount, 1);
  assert.equal(backup.summary.taskCommentsCount, 1);
  assert.equal(backup.summary.goalsCount, 1);
  assert.equal(backup.summary.workstreamsCount, 1);

  // Check data contents and serialization
  assert.equal(backup.projects[0].slug, "zedu-vulcan");
  assert.equal(typeof backup.projects[0].createdAt, "string");
  assert.equal(backup.tasks[0].title, "Research Competitor Pricing");
  assert.equal(typeof backup.tasks[0].createdAt, "string");
  assert.equal(backup.pointsLedger[0].amount, 50);
  assert.equal(typeof backup.pointsLedger[0].amount, "number");
  assert.equal(backup.pointsLedger[0].reason, "task_approved");

  // Verify agents don't leak keyHash
  assert.equal((backup.agents[0] as unknown as { keyHash?: string }).keyHash, undefined);
  assert.equal(backup.agents[0].name, "ResearchBot");
});

test("exportDatabaseData: successfully exports all projects for a platform admin", async () => {
  const db = createMockDb();
  const backup = await exportDatabaseData(db, {
    userId: "user-platform-admin",
  });

  assert.equal(backup.metadata.projectCount, 1);
  assert.equal(backup.summary.projectsCount, 1);
  assert.equal(backup.metadata.exportedBy.id, "user-platform-admin");
});

test("OpenAPI documents /api/admin/export", () => {
  const doc = getOpenApiDocument();
  assert.ok(doc.paths?.["/api/admin/export"]?.get, "Expected GET /api/admin/export in OpenAPI doc");
  const getOp = doc.paths["/api/admin/export"].get;
  assert.equal(getOp.operationId, "exportDatabaseBackup");
  assert.ok(getOp.responses?.["200"], "Expected 200 response documented");
  assert.ok(getOp.responses?.["403"], "Expected 403 response documented");
});

test("exportDatabaseSpreadsheet: generates a valid excel buffer with all sheets", async () => {
  const db = createMockDb();
  const backup = await exportDatabaseData(db, {
    userId: "user-admin",
    projectId: "proj-1",
  });

  const buffer = await exportDatabaseSpreadsheet(backup);
  assert.ok(buffer instanceof Buffer, "Expected a Buffer instance");
  assert.ok(buffer.length > 0, "Buffer should not be empty");

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  assert.deepEqual(sheetNames, [
    "Summary",
    "Points Ledger",
    "Users & Balances",
    "Tasks",
    "Comments & Reviews",
    "Agents",
  ]);

  const pointsSheet = workbook.getWorksheet("Points Ledger");
  assert.ok(pointsSheet, "Points Ledger sheet must exist");
  assert.equal(pointsSheet.rowCount, 3); // Header row + 2 ledger entries
});

