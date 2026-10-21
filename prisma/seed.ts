/**
 * Seed for the shared dev database.
 *
 * Points domain (PR 5): task types, point rules, users, agents, three weeks of
 * ledger entries and a few tasks.
 *
 * Ideas demo (task 2.2): one goal with a proposed, an accepted and a rejected
 * workstream, plus a local test agent whose key can call the idea endpoints:
 *   X-Agent-Key: zedu_ak_seed_local_agent_key_000000000000000000
 *
 * Idempotent — every section skips rows that already exist (fixed ids, unique
 * keys and upserts), so `npx prisma db seed` is safe to re-run.
 *
 * Requires the points schema (task_types, point_rules, points_ledger,
 * User.is_platform_admin). The `tasks` section is guarded behind the
 * `assignedAgentId` column and the ideas section behind the Goal/Workstream
 * tables, because they belong to unit 3: each is seeded when present and
 * skipped with a warning otherwise.
 *
 * Weeks are Africa/Lagos, Monday to Sunday, anchored to the week of
 * Mon 2026-10-19 ("this week"). The boundary entries land one minute apart:
 * Lagos Sun 23:59 (22:59 UTC, week of 10-12) and Lagos Mon 00:00 (23:00 UTC,
 * week of 10-19).
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
const PROJECT_ID = "project_zedu";

const TASK_TYPES = [
  { id: "tt_research", slug: "research", name: "Research", description: "Investigate and report findings", points: 20, maxPoints: 50, isActive: true },
  { id: "tt_leads", slug: "lead_hunting", name: "Lead hunting", description: "Find and qualify contacts", points: 30, maxPoints: 50, isActive: true },
  { id: "tt_content", slug: "content", name: "Content", description: "Articles, posts, guides", points: 40, maxPoints: 50, isActive: true },
  { id: "tt_seo", slug: "seo", name: "SEO", description: "On-page and technical fixes", points: 25, maxPoints: 50, isActive: true },
  { id: "tt_press", slug: "press", name: "Press", description: "Pitches and media outreach", points: 35, maxPoints: 50, isActive: true },
  { id: "tt_quick", slug: "quick_fix", name: "Quick fix", description: "Small, well-scoped fixes", points: 5, maxPoints: 10, isActive: true },
  { id: "tt_data", slug: "data_entry", name: "Data entry", description: "List building and cleanup", points: 5, maxPoints: 10, isActive: false },
] as const;

const POINT_RULES = [
  { ruleKey: "review_submitted", amount: 1, enabled: true, weeklyCap: null },
  { ruleKey: "idea_accepted", amount: 5, enabled: false, weeklyCap: null },
  { ruleKey: "task_proposal_accepted", amount: 5, enabled: false, weeklyCap: null },
  { ruleKey: "weekly_target", amount: 500, enabled: false, weeklyCap: null },
] as const;

// Six users. u_kemi earns nothing (the "user at 0"); u_sam is over target;
// u_michael is the demo platform admin.
const USERS = [
  { id: "u_michael", name: "Michael Abu", email: "michael@zedu.example", isAdmin: true },
  { id: "u_ada", name: "Ada Okafor", email: "ada@zedu.example", isAdmin: false },
  { id: "u_tunde", name: "Tunde Bello", email: "tunde@zedu.example", isAdmin: false },
  { id: "u_chioma", name: "Chioma Eze", email: "chioma@zedu.example", isAdmin: false },
  { id: "u_kemi", name: "Kemi Alabi", email: "kemi@zedu.example", isAdmin: false },
  { id: "u_sam", name: "Sam Yusuf", email: "sam@zedu.example", isAdmin: false },
] as const;

const AGENTS = [
  { id: "a_ink", name: "Inkwell", speciality: "Long-form content", ownerId: "u_michael" },
  { id: "a_scout", name: "SEO Scout", speciality: "Technical SEO", ownerId: "u_ada" },
  { id: "a_wire", name: "Newswire", speciality: "Press outreach", ownerId: "u_ada" },
  { id: "a_quill", name: "Quill", speciality: "Content editing", ownerId: "u_tunde" },
  { id: "a_spark", name: "Spark", speciality: "Social copy", ownerId: "u_tunde" },
  { id: "a_hunter", name: "Lead Hunter", speciality: "Lead research", ownerId: "u_chioma" },
  { id: "a_pulse", name: "Pulse", speciality: "Analytics", ownerId: "u_chioma" },
  { id: "a_metro", name: "Metro", speciality: "Distribution", ownerId: "u_sam" },
  { id: "a_vertex", name: "Vertex", speciality: "Peer reviews", ownerId: "u_sam" },
  { id: "a_coda", name: "Coda", speciality: "Research", ownerId: "u_kemi" },
] as const;

type LedgerSeed = {
  id: string;
  userId: string;
  agentId?: string;
  amount: number;
  reason: "task_approved" | "review_submitted" | "idea_accepted" | "manual_adjustment" | "reversal";
  sourceType?: "task" | "comment" | "idea";
  sourceId?: string;
  note?: string;
  createdAt: string;
};

function ledger(input: LedgerSeed) {
  return {
    id: input.id,
    userId: input.userId,
    agentId: input.agentId ?? null,
    projectId: PROJECT_ID,
    amount: input.amount,
    reason: input.reason,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    idempotencyKey: `${input.reason}:${input.sourceType ?? ""}:${input.sourceId ?? input.id}`,
    grantedByUserId: null,
    note: input.note ?? null,
    createdAt: new Date(input.createdAt),
  };
}

const LEDGER: LedgerSeed[] = [
  // ── This week (Mon 2026-10-19) ──────────────────────────────────────────
  // Sam is comfortably over target: 540 task points + 20 reviews.
  { id: "l_sam_1", userId: "u_sam", agentId: "a_metro", amount: 200, reason: "task_approved", sourceType: "task", sourceId: "t_sam_1", createdAt: "2026-10-19T10:00:00Z" },
  { id: "l_sam_2", userId: "u_sam", agentId: "a_vertex", amount: 150, reason: "task_approved", sourceType: "task", sourceId: "t_sam_2", createdAt: "2026-10-20T08:30:00Z" },
  { id: "l_sam_3", userId: "u_sam", agentId: "a_metro", amount: 190, reason: "task_approved", sourceType: "task", sourceId: "t_sam_3", createdAt: "2026-10-20T09:10:00Z" },
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `l_sam_r_${i}`,
    userId: "u_sam",
    agentId: "a_vertex",
    amount: 1,
    reason: "review_submitted" as const,
    sourceType: "comment" as const,
    sourceId: `review_sam_${i}`,
    createdAt: "2026-10-19T12:00:00Z",
  })),

  // Michael: 110 tasks + 10 reviews + 2 ideas − 10 adjustment = 120.
  { id: "l_m_1", userId: "u_michael", agentId: "a_ink", amount: 70, reason: "task_approved", sourceType: "task", sourceId: "t_ink_1", createdAt: "2026-10-19T11:00:00Z" },
  { id: "l_m_2", userId: "u_michael", agentId: "a_ink", amount: 40, reason: "task_approved", sourceType: "task", sourceId: "t_ink_2", createdAt: "2026-10-20T07:45:00Z" },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `l_m_r_${i}`,
    userId: "u_michael",
    agentId: "a_ink",
    amount: 1,
    reason: "review_submitted" as const,
    sourceType: "comment" as const,
    sourceId: `review_ink_${i}`,
    createdAt: "2026-10-19T14:00:00Z",
  })),
  { id: "l_m_i_1", userId: "u_michael", agentId: "a_ink", amount: 5, reason: "idea_accepted", sourceType: "idea", sourceId: "idea_ink_1", createdAt: "2026-10-19T09:00:00Z" },
  { id: "l_m_i_2", userId: "u_michael", agentId: "a_ink", amount: 5, reason: "idea_accepted", sourceType: "idea", sourceId: "idea_ink_2", createdAt: "2026-10-19T09:05:00Z" },
  { id: "l_m_adj", userId: "u_michael", amount: -10, reason: "manual_adjustment", note: "Corrected a duplicate payout.", createdAt: "2026-10-20T08:00:00Z" },

  // Ada, Chioma, Tunde.
  { id: "l_a_1", userId: "u_ada", agentId: "a_scout", amount: 200, reason: "task_approved", sourceType: "task", sourceId: "t_scout_1", createdAt: "2026-10-19T10:20:00Z" },
  { id: "l_a_2", userId: "u_ada", agentId: "a_wire", amount: 140, reason: "task_approved", sourceType: "task", sourceId: "t_wire_1", createdAt: "2026-10-20T06:50:00Z" },
  { id: "l_a_3", userId: "u_ada", agentId: "a_scout", amount: 12, reason: "review_submitted", sourceType: "comment", sourceId: "review_scout_1", createdAt: "2026-10-19T13:00:00Z" },
  { id: "l_c_1", userId: "u_chioma", agentId: "a_hunter", amount: 160, reason: "task_approved", sourceType: "task", sourceId: "t_hunter_1", createdAt: "2026-10-19T11:40:00Z" },
  { id: "l_c_2", userId: "u_chioma", agentId: "a_pulse", amount: 40, reason: "task_approved", sourceType: "task", sourceId: "t_pulse_1", createdAt: "2026-10-20T08:10:00Z" },
  { id: "l_c_3", userId: "u_chioma", agentId: "a_hunter", amount: 5, reason: "review_submitted", sourceType: "comment", sourceId: "review_hunter_1", createdAt: "2026-10-19T15:00:00Z" },
  { id: "l_t_1", userId: "u_tunde", agentId: "a_quill", amount: 90, reason: "task_approved", sourceType: "task", sourceId: "t_quill_1", createdAt: "2026-10-20T09:40:00Z" },

  // Boundary: Lagos Sun 23:59 (22:59 UTC → week of 10-12) vs Lagos Mon 00:00
  // (23:00 UTC → week of 10-19). One minute apart on the Lagos clock.
  { id: "l_bnd_end", userId: "u_tunde", agentId: "a_spark", amount: 1, reason: "review_submitted", sourceType: "comment", sourceId: "review_spark_1", createdAt: "2026-10-18T22:59:00Z" },
  { id: "l_bnd_start", userId: "u_ada", agentId: "a_scout", amount: 1, reason: "review_submitted", sourceType: "comment", sourceId: "review_scout_2", createdAt: "2026-10-18T23:00:00Z" },

  // ── Previous weeks (10-05 … 10-18) for last_week / all_time ─────────────
  { id: "l_p_1", userId: "u_sam", agentId: "a_metro", amount: 180, reason: "task_approved", sourceType: "task", sourceId: "t_sam_p1", createdAt: "2026-10-12T10:00:00Z" },
  { id: "l_p_2", userId: "u_sam", agentId: "a_vertex", amount: 5, reason: "idea_accepted", sourceType: "idea", sourceId: "idea_vertex_p1", createdAt: "2026-10-13T09:00:00Z" },
  { id: "l_p_3", userId: "u_ada", agentId: "a_wire", amount: 120, reason: "task_approved", sourceType: "task", sourceId: "t_wire_p1", createdAt: "2026-10-14T11:00:00Z" },
  { id: "l_p_4", userId: "u_chioma", agentId: "a_hunter", amount: -20, reason: "reversal", sourceType: "task", sourceId: "t_hunter_p1", note: "Task reopened after two failed revision rounds.", createdAt: "2026-10-15T12:00:00Z" },
  { id: "l_p_5", userId: "u_tunde", agentId: "a_quill", amount: 70, reason: "task_approved", sourceType: "task", sourceId: "t_quill_p1", createdAt: "2026-10-16T10:30:00Z" },
  { id: "l_p_6", userId: "u_michael", agentId: "a_ink", amount: 55, reason: "task_approved", sourceType: "task", sourceId: "t_ink_p1", createdAt: "2026-10-06T10:00:00Z" },
  { id: "l_p_7", userId: "u_ada", agentId: "a_scout", amount: 30, reason: "review_submitted", sourceType: "comment", sourceId: "review_scout_p1", createdAt: "2026-10-07T13:00:00Z" },
  { id: "l_p_8", userId: "u_chioma", agentId: "a_pulse", amount: 45, reason: "task_approved", sourceType: "task", sourceId: "t_pulse_p1", createdAt: "2026-10-08T09:00:00Z" },
];

// Agent-task rows (unit 3's foundation reuses the "Task" table). Seeded only
// when the agent-task columns exist. points_snapshot / task_type_id are still
// a unit-0 follow-up and are omitted until those columns land.
const TASKS = [
  { id: "t_quill_guide", title: "Publish travel guide", status: "approved", taskType: "content", agentId: "a_quill", offeredAt: "2026-10-12T10:00:00Z" },
  { id: "t_scout_h1", title: "Fix pricing page H1", status: "in_progress", taskType: "seo", agentId: "a_scout", offeredAt: "2026-10-19T10:00:00Z" },
  { id: "t_hunter_bootcamps", title: "Build bootcamp list", status: "in_progress", taskType: "lead_hunting", agentId: "a_hunter", offeredAt: "2026-10-20T08:00:00Z" },
] as const;

const IDEAS_AGENT_KEY = "zedu_ak_seed_local_agent_key_000000000000000000";
const IDEAS_AGENT_KEY_HASH = createHash("sha256").update(IDEAS_AGENT_KEY).digest("hex");

// Demo data for the ideas endpoints (task 2.2). Needs the Goal and Workstream
// tables from unit 3's foundation; skipped until they exist.
async function seedIdeas() {
  const user = await prisma.user.upsert({
    where: { email: "ideas-seed@zedu.local" },
    update: {},
    create: { email: "ideas-seed@zedu.local", name: "Ideas Seed User" },
  });

  const agent = await prisma.agent.upsert({
    where: { keyHash: IDEAS_AGENT_KEY_HASH },
    update: {},
    create: {
      name: "Seed Local Agent",
      speciality: "seo",
      keyHash: IDEAS_AGENT_KEY_HASH,
      keyHint: "zedu_ak_…0000",
      avatarStyle: "bottts-neutral",
      avatarSeed: "seed-agent",
      connectedAt: new Date(),
      ownerId: user.id,
    },
  });

  const existingGoal = await prisma.goal.findFirst({
    where: { title: "Make Zedu SEO compliant" },
    select: { id: true, title: true },
  });
  const goal =
    existingGoal ??
    (await prisma.goal.create({
      data: {
        title: "Make Zedu SEO compliant",
        description: "Fix the site's on-page SEO so search engines index it cleanly.",
        type: "seo",
        status: "active",
        createdById: user.id,
      },
      select: { id: true, title: true },
    }));

  const ideas: Array<[string, "proposed" | "accepted" | "rejected"]> = [
    ["On-page SEO audit pass", "proposed"],
    ["Fix meta and OG tags across pages", "accepted"],
    ["Rewrite page titles for target keywords", "rejected"],
  ];
  for (const [title, status] of ideas) {
    await prisma.workstream.upsert({
      where: { goalId_title: { goalId: goal.id, title } },
      update: { status, proposedByAgentId: agent.id, acceptedById: status === "proposed" ? null : user.id },
      create: { goalId: goal.id, title, status, proposedByAgentId: agent.id, acceptedById: status === "proposed" ? null : user.id },
    });
  }

  console.log(`Ideas seed complete: goal "${goal.title}", 3 workstreams, agent key ${IDEAS_AGENT_KEY}`);
}

async function main() {
  const counts = { taskTypes: 0, rules: 0, users: 0, agents: 0, ledger: 0, tasks: 0 };

  for (const type of TASK_TYPES) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM task_types WHERE id = ${type.id} LIMIT 1`;
    if (existing.length > 0) continue;
    await prisma.$executeRaw`
      INSERT INTO task_types (id, slug, name, description, points, max_points, is_active, created_at, updated_at)
      VALUES (${type.id}, ${type.slug}, ${type.name}, ${type.description}, ${type.points},
              ${type.maxPoints}, ${type.isActive}, now(), now())`;
    counts.taskTypes += 1;
  }

  for (const rule of POINT_RULES) {
    const existing = await prisma.$queryRaw<{ rule_key: string }[]>`SELECT rule_key FROM point_rules WHERE rule_key = ${rule.ruleKey} LIMIT 1`;
    if (existing.length > 0) continue;
    await prisma.$executeRaw`
      INSERT INTO point_rules (rule_key, amount, enabled, weekly_cap)
      VALUES (${rule.ruleKey}, ${rule.amount}, ${rule.enabled}, ${rule.weeklyCap})`;
    counts.rules += 1;
  }

  for (const user of USERS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${user.id} LIMIT 1`;
    if (existing.length > 0) continue;
    await prisma.$executeRaw`
      INSERT INTO "User" (id, name, email, is_platform_admin)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.isAdmin})`;
    counts.users += 1;
  }

  for (const agent of AGENTS) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Agent" WHERE id = ${agent.id} LIMIT 1`;
    if (existing.length > 0) continue;
    const keyHash = randomBytes(32).toString("hex");
    await prisma.$executeRaw`
      INSERT INTO "Agent" (id, name, speciality, description, "avatarStyle", "avatarSeed", "keyHash", "keyHint", "ownerId", "createdAt", "updatedAt")
      VALUES (${agent.id}, ${agent.name}, ${agent.speciality}, null, 'bottts-neutral', ${agent.id}, ${keyHash}, ${`zedu_ak_…${keyHash.slice(-4)}`}, ${agent.ownerId}, now(), now())`;
    counts.agents += 1;
  }

  for (const raw of LEDGER) {
    const entry = ledger(raw);
    const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM points_ledger WHERE idempotency_key = ${entry.idempotencyKey} LIMIT 1`;
    if (existing.length > 0) continue;
    await prisma.$executeRaw`
      INSERT INTO points_ledger
        (id, user_id, agent_id, project_id, amount, reason, source_type, source_id, idempotency_key, granted_by_user_id, note, created_at)
      VALUES
        (${entry.id}, ${entry.userId}, ${entry.agentId}, ${entry.projectId}, ${entry.amount}, ${entry.reason},
         ${entry.sourceType}, ${entry.sourceId}, ${entry.idempotencyKey}, ${entry.grantedByUserId}, ${entry.note}, ${entry.createdAt})`;
    counts.ledger += 1;
  }

  // Agent-task rows (unit 3's foundation reuses the "Task" table). Seed only
  // when the agent-task columns exist.
  const taskColumns = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Task' AND column_name = 'assignedAgentId'
    ) AS exists`;
  if (taskColumns[0]?.exists) {
    for (const task of TASKS) {
      const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Task" WHERE id = ${task.id} LIMIT 1`;
      if (existing.length > 0) continue;
      await prisma.$executeRaw`
        INSERT INTO "Task" (id, title, status, "taskType", "assignedAgentId", "offeredAt", "createdAt", "updatedAt")
        VALUES (${task.id}, ${task.title}, ${task.status}, ${task.taskType}, ${task.agentId}, ${new Date(task.offeredAt)}, now(), now())`;
      counts.tasks += 1;
    }
  } else {
    console.log("Skipped task seeding — the agent-task columns on \"Task\" (unit 3's foundation) do not exist yet.");
  }

  const ideasTables = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT (to_regclass('"Goal"') IS NOT NULL AND to_regclass('"Workstream"') IS NOT NULL) AS exists`;
  if (ideasTables[0]?.exists) {
    await seedIdeas();
  } else {
    console.log("Skipped ideas seeding — the \"Goal\"/\"Workstream\" tables (unit 3's foundation) do not exist yet.");
  }

  console.log(
    `Points seed complete: ${counts.taskTypes} task types, ${counts.rules} point rules, ${counts.users} users, ` +
      `${counts.agents} agents, ${counts.ledger} ledger entries, ${counts.tasks} tasks (existing rows skipped).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
