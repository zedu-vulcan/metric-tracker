import type { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

export interface ExportDatabaseDataOptions {
  userId: string;
  projectId?: string | null;
}

export type DbClient = Pick<
  PrismaClient,
  | "user"
  | "project"
  | "projectMember"
  | "agent"
  | "pointsLedger"
  | "task"
  | "taskComment"
  | "taskTypeDef"
  | "pointRule"
  | "contentItem"
  | "directory"
  | "pressOutlet"
  | "pressCoverage"
  | "pressSubmission"
>;

export async function exportDatabaseData(
  db: DbClient,
  options: ExportDatabaseDataOptions
) {
  // 1. Verify user exists and check isPlatformAdmin
  const user = await db.user.findUnique({
    where: { id: options.userId },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  if (!user) {
    throw new Error("Unauthorized: User not found");
  }

  // 2. Determine target projects
  let targetProjectIds: string[] = [];
  if (options.projectId) {
    // If specific project requested, verify user is either platform admin or has admin/owner role
    if (!user.isPlatformAdmin) {
      const membership = await db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: options.projectId, userId: user.id },
        },
      });
      if (
        !membership ||
        (membership.role !== "admin" && membership.role !== "owner")
      ) {
        throw new Error(
          "Forbidden: Admin or owner role required for this project"
        );
      }
    }
    targetProjectIds = [options.projectId];
  } else {
    // If no project specified:
    if (user.isPlatformAdmin) {
      const allProjects = await db.project.findMany({ select: { id: true } });
      targetProjectIds = allProjects.map((p) => p.id);
    } else {
      const adminMemberships = await db.projectMember.findMany({
        where: {
          userId: user.id,
          role: { in: ["admin", "owner"] },
        },
        select: { projectId: true },
      });
      if (adminMemberships.length === 0) {
        throw new Error(
          "Forbidden: Admin or owner role required on at least one project"
        );
      }
      targetProjectIds = adminMemberships.map((m) => m.projectId);
    }
  }

  // 3. Fetch all data for target projects
  const [
    projects,
    projectMembers,
    agents,
    pointsLedger,
    tasks,
    taskComments,
    taskTypes,
    pointRules,
    contentItems,
    directories,
    pressOutlets,
    pressCoverage,
    pressSubmissions,
  ] = await Promise.all([
    db.project.findMany({
      where: { id: { in: targetProjectIds } },
      orderBy: { createdAt: "asc" },
    }),
    db.projectMember.findMany({
      where: { projectId: { in: targetProjectIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isPlatformAdmin: true,
          },
        },
      },
    }),
    db.agent.findMany({
      where: { projectId: { in: targetProjectIds } },
      select: {
        id: true,
        projectId: true,
        name: true,
        speciality: true,
        description: true,
        avatarStyle: true,
        avatarSeed: true,
        ownerId: true,
        connectedAt: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.pointsLedger.findMany({
      where: { projectId: { in: targetProjectIds } },
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      where: { projectId: { in: targetProjectIds } },
      orderBy: { createdAt: "asc" },
    }),
    db.taskComment.findMany({
      where: { task: { projectId: { in: targetProjectIds } } },
      orderBy: { createdAt: "asc" },
    }),
    db.taskTypeDef.findMany({
      where: { projectId: { in: targetProjectIds } },
      orderBy: { createdAt: "asc" },
    }),
    db.pointRule.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
    db.contentItem.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
    db.directory.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
    db.pressOutlet.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
    db.pressCoverage.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
    db.pressSubmission.findMany({
      where: { projectId: { in: targetProjectIds } },
    }),
  ]);

  // Collect all unique user IDs involved across projects, ledger, tasks, agents
  const userIds = new Set<string>();
  projectMembers.forEach((pm) => userIds.add(pm.userId));
  agents.forEach((a) => userIds.add(a.ownerId));
  tasks.forEach((t) => {
    if (t.ownerId) userIds.add(t.ownerId);
    if (t.userId) userIds.add(t.userId);
  });
  pointsLedger.forEach((pl) => {
    userIds.add(pl.userId);
    if (pl.grantedByUserId) userIds.add(pl.grantedByUserId);
  });

  const users = await db.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isPlatformAdmin: true,
    },
  });

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      version: "2.0",
      projectCount: targetProjectIds.length,
    },
    summary: {
      projectsCount: projects.length,
      usersCount: users.length,
      agentsCount: agents.length,
      tasksCount: tasks.length,
      pointsLedgerCount: pointsLedger.length,
      totalPointsAwarded: pointsLedger.reduce(
        (sum, pl) => sum + Number(pl.amount),
        0
      ),
      taskCommentsCount: taskComments.length,
    },
    projects: projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    projectMembers: projectMembers.map((pm) => ({
      ...pm,
      joinedAt: pm.joinedAt.toISOString(),
    })),
    users,
    agents: agents.map((a) => ({
      ...a,
      connectedAt: a.connectedAt?.toISOString() ?? null,
      lastActiveAt: a.lastActiveAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    pointsLedger: pointsLedger.map((pl) => ({
      ...pl,
      amount: Number(pl.amount),
      createdAt: pl.createdAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      ...t,
      ref: `T-${t.number}`,
      offeredAt: t.offeredAt?.toISOString() ?? null,
      offerExpiresAt: t.offerExpiresAt?.toISOString() ?? null,
      dueAt: t.dueAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    taskComments: taskComments.map((tc) => ({
      ...tc,
      createdAt: tc.createdAt.toISOString(),
      updatedAt: tc.updatedAt.toISOString(),
    })),
    taskTypes: taskTypes.map((tt) => ({
      ...tt,
      createdAt: tt.createdAt.toISOString(),
      updatedAt: tt.updatedAt.toISOString(),
    })),
    pointRules: pointRules.map((pr) => ({
      ...pr,
      amount: Number(pr.amount),
    })),
    marketing: {
      contentItems: contentItems.map((c) => ({
        ...c,
        createdDate: c.createdDate.toISOString(),
        publishDate: c.publishDate?.toISOString() ?? null,
        updatedDate: c.updatedDate?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      directories: directories.map((d) => ({
        ...d,
        dateSubmitted: d.dateSubmitted?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      pressOutlets: pressOutlets.map((po) => ({
        ...po,
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString(),
      })),
      pressCoverage: pressCoverage.map((pc) => ({
        ...pc,
        publicationDate: pc.publicationDate?.toISOString() ?? null,
        createdAt: pc.createdAt.toISOString(),
        updatedAt: pc.updatedAt.toISOString(),
      })),
      pressSubmissions: pressSubmissions.map((ps) => ({
        ...ps,
        dateSubmitted: ps.dateSubmitted?.toISOString() ?? null,
        followUpDate: ps.followUpDate?.toISOString() ?? null,
        createdAt: ps.createdAt.toISOString(),
        updatedAt: ps.updatedAt.toISOString(),
      })),
    },
  };
}

export type ExportedData = Awaited<ReturnType<typeof exportDatabaseData>>;

export async function exportDatabaseSpreadsheet(
  data: ExportedData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zedu Metric Tracker";
  workbook.created = new Date();

  // 1. Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 40 },
  ];
  summarySheet.addRows([
    { metric: "Exported At", value: data.metadata.exportedAt },
    { metric: "Exported By Name", value: data.metadata.exportedBy.name ?? "N/A" },
    { metric: "Exported By Email", value: data.metadata.exportedBy.email ?? "N/A" },
    { metric: "Projects Count", value: data.summary.projectsCount },
    { metric: "Total Users", value: data.summary.usersCount },
    { metric: "Total Agents", value: data.summary.agentsCount },
    { metric: "Total Tasks", value: data.summary.tasksCount },
    { metric: "Total Points Awarded", value: data.summary.totalPointsAwarded },
    { metric: "Total Points Ledger Entries", value: data.summary.pointsLedgerCount },
    { metric: "Total Task Comments", value: data.summary.taskCommentsCount },
  ]);

  // Project details & invites (join codes and invite links)
  if (data.projects.length === 1) {
    const p = data.projects[0];
    summarySheet.addRows([
      { metric: "Project Name", value: p.name },
      { metric: "Project Slug", value: p.slug },
      { metric: "Project Join Code", value: p.joinCode ?? "N/A" },
      { metric: "Project Invite Token", value: p.inviteToken ?? "N/A" },
      { metric: "Project Invite Link", value: p.inviteToken ? `/join/${p.inviteToken}` : "N/A" },
    ]);
  } else if (data.projects.length > 1) {
    data.projects.forEach((p, index) => {
      summarySheet.addRows([
        { metric: `Project ${index + 1} Name`, value: p.name },
        { metric: `Project ${index + 1} Join Code`, value: p.joinCode ?? "N/A" },
        { metric: `Project ${index + 1} Invite Link`, value: p.inviteToken ? `/join/${p.inviteToken}` : "N/A" },
      ]);
    });
  }

  // Maps for quick relation lookups
  const userMap = new Map(data.users.map((u) => [u.id, u]));
  const agentMap = new Map(data.agents.map((a) => [a.id, a]));
  const projectMap = new Map(data.projects.map((p) => [p.id, p]));

  // 2. Points Ledger Sheet
  const pointsSheet = workbook.addWorksheet("Points Ledger");
  pointsSheet.columns = [
    { header: "Date", key: "date", width: 22 },
    { header: "User Name", key: "userName", width: 25 },
    { header: "User Email", key: "userEmail", width: 30 },
    { header: "Agent Name", key: "agentName", width: 20 },
    { header: "Points Amount", key: "amount", width: 15 },
    { header: "Reason", key: "reason", width: 20 },
    { header: "Source Type", key: "sourceType", width: 15 },
    { header: "Source ID", key: "sourceId", width: 28 },
    { header: "Note", key: "note", width: 35 },
    { header: "Idempotency Key", key: "idempotencyKey", width: 35 },
    { header: "Project", key: "project", width: 20 },
  ];

  data.pointsLedger.forEach((pl) => {
    const user = userMap.get(pl.userId as string);
    const agent = pl.agentId ? agentMap.get(pl.agentId as string) : null;
    const project = projectMap.get(pl.projectId as string);
    pointsSheet.addRow({
      date: pl.createdAt,
      userName: user?.name ?? "N/A",
      userEmail: user?.email ?? "N/A",
      agentName: agent?.name ?? "-",
      amount: pl.amount,
      reason: pl.reason,
      sourceType: pl.sourceType ?? "-",
      sourceId: pl.sourceId ?? "-",
      note: pl.note ?? "",
      idempotencyKey: pl.idempotencyKey,
      project: project?.name ?? pl.projectId,
    });
  });

  // 3. User Balances / Scoreboard Sheet
  const balanceMap = new Map<string, number>();
  data.pointsLedger.forEach((pl) => {
    const uid = pl.userId as string;
    balanceMap.set(uid, (balanceMap.get(uid) ?? 0) + Number(pl.amount));
  });

  const usersSheet = workbook.addWorksheet("Users & Balances");
  usersSheet.columns = [
    { header: "User ID", key: "id", width: 28 },
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Total Points Balance", key: "balance", width: 20 },
    { header: "Platform Admin", key: "isPlatformAdmin", width: 18 },
  ];

  data.users.forEach((u) => {
    usersSheet.addRow({
      id: u.id,
      name: u.name ?? "N/A",
      email: u.email ?? "N/A",
      balance: balanceMap.get(u.id) ?? 0,
      isPlatformAdmin: u.isPlatformAdmin ? "Yes" : "No",
    });
  });

  // 4. Tasks Sheet
  const tasksSheet = workbook.addWorksheet("Tasks");
  tasksSheet.columns = [
    { header: "Ref", key: "ref", width: 12 },
    { header: "Task ID", key: "id", width: 28 },
    { header: "Title", key: "title", width: 35 },
    { header: "Status", key: "status", width: 18 },
    { header: "Task Type", key: "taskType", width: 18 },
    { header: "Points", key: "points", width: 12 },
    { header: "Assigned Agent", key: "assignedAgent", width: 20 },
    { header: "Creator Email", key: "creatorEmail", width: 30 },
    { header: "Created At", key: "createdAt", width: 22 },
    { header: "Completed At", key: "completedAt", width: 22 },
    { header: "Project", key: "project", width: 20 },
  ];

  data.tasks.forEach((t) => {
    const agent = t.assignedAgentId ? agentMap.get(t.assignedAgentId as string) : null;
    const user = t.userId ? userMap.get(t.userId as string) : null;
    const project = projectMap.get(t.projectId as string);
    tasksSheet.addRow({
      ref: `T-${(t as { number?: number }).number ?? 0}`,
      id: t.id,
      title: t.title,
      status: t.status,
      taskType: t.taskType ?? t.type ?? "Other",
      points: t.points ?? "-",
      assignedAgent: agent?.name ?? "Unassigned",
      creatorEmail: user?.email ?? "N/A",
      createdAt: t.createdAt,
      completedAt: t.completedAt ?? "-",
      project: project?.name ?? t.projectId,
    });
  });

  // 5. Task Comments & Reviews Sheet
  const commentsSheet = workbook.addWorksheet("Comments & Reviews");
  commentsSheet.columns = [
    { header: "Comment ID", key: "id", width: 28 },
    { header: "Task ID", key: "taskId", width: 28 },
    { header: "Type", key: "type", width: 18 },
    { header: "Author", key: "author", width: 22 },
    { header: "Score", key: "score", width: 10 },
    { header: "Verdict", key: "verdict", width: 12 },
    { header: "Body", key: "body", width: 45 },
    { header: "Attachment", key: "attachment", width: 35 },
    { header: "Created At", key: "createdAt", width: 22 },
  ];

  data.taskComments.forEach((tc) => {
    const author = tc.authorAgentId
      ? agentMap.get(tc.authorAgentId as string)?.name
      : tc.authorUserId
      ? userMap.get(tc.authorUserId as string)?.name ?? userMap.get(tc.authorUserId as string)?.email
      : "Unknown";

    commentsSheet.addRow({
      id: tc.id,
      taskId: tc.taskId,
      type: tc.type,
      author: author ?? "-",
      score: tc.score ?? "-",
      verdict: tc.verdict ?? "-",
      body: tc.body ?? "",
      attachment: tc.attachment ?? "-",
      createdAt: tc.createdAt,
    });
  });

  // 6. Agents Sheet
  const agentsSheet = workbook.addWorksheet("Agents");
  agentsSheet.columns = [
    { header: "Agent ID", key: "id", width: 28 },
    { header: "Name", key: "name", width: 22 },
    { header: "Speciality", key: "speciality", width: 20 },
    { header: "Owner Email", key: "ownerEmail", width: 30 },
    { header: "Connected At", key: "connectedAt", width: 22 },
    { header: "Last Active At", key: "lastActiveAt", width: 22 },
    { header: "Project", key: "project", width: 20 },
  ];

  data.agents.forEach((a) => {
    const owner = userMap.get(a.ownerId as string);
    const project = projectMap.get(a.projectId as string);
    agentsSheet.addRow({
      id: a.id,
      name: a.name,
      speciality: a.speciality,
      ownerEmail: owner?.email ?? "N/A",
      connectedAt: a.connectedAt ?? "-",
      lastActiveAt: a.lastActiveAt ?? "-",
      project: project?.name ?? a.projectId,
    });
  });

  // Style header rows
  [summarySheet, pointsSheet, usersSheet, tasksSheet, commentsSheet, agentsSheet].forEach((sheet) => {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE9EEF4" },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
