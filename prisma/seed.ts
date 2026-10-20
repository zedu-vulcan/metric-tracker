/**
 * Seed data for the ideas endpoints (task 2.2).
 *
 * Idempotent: safe to re-run. Run with:
 *   npx prisma db seed     (or)   npx tsx prisma/seed.ts
 *
 * Creates one demo goal owned by the first user (creating one if needed) with:
 * - a workstream the local agent already proposed (status `proposed`),
 * - an accepted workstream,
 * - a rejected workstream,
 * and a local test agent whose key can be used to call the idea endpoints:
 *   X-Agent-Key: seed-local-agent-key
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOCAL_AGENT_KEY = "zedu_ak_seed_local_agent_key_000000000000000000";
const LOCAL_AGENT_KEY_HASH = createHash("sha256").update(LOCAL_AGENT_KEY).digest("hex");

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "ideas-seed@zedu.local" },
    update: {},
    create: {
      email: "ideas-seed@zedu.local",
      name: "Ideas Seed User",
    },
  });

  const agent = await prisma.agent.upsert({
    where: { keyHash: LOCAL_AGENT_KEY_HASH },
    update: {},
    create: {
      name: "Seed Local Agent",
      speciality: "seo",
      keyHash: LOCAL_AGENT_KEY_HASH,
      keyHint: "zedu_ak_…0000",
      avatarStyle: "bottts-neutral",
      avatarSeed: "seed-agent",
      connectedAt: new Date(),
      ownerId: user.id,
    },
  });

  const goal = await prisma.goal.upsert({
    where: { id: await findGoalId("Make Zedu SEO compliant") ?? "" },
    update: {},
    create: {
      title: "Make Zedu SEO compliant",
      description: "Fix the site's on-page SEO so search engines index it cleanly.",
      type: "seo",
      status: "active",
      createdById: user.id,
    },
  });

  const ideas: Array<[string, "proposed" | "accepted" | "rejected"]> = [
    ["On-page SEO audit pass", "proposed"],
    ["Fix meta and OG tags across pages", "accepted"],
    ["Rewrite page titles for target keywords", "rejected"],
  ];
  for (const [title, status] of ideas) {
    await prisma.workstream.upsert({
      where: { goalId_title: { goalId: goal.id, title } },
      update: {
        status,
        proposedByAgentId: agent.id,
        acceptedById: status === "proposed" ? null : user.id,
      },
      create: {
        goalId: goal.id,
        title,
        status,
        proposedByAgentId: agent.id,
        acceptedById: status === "proposed" ? null : user.id,
      },
    });
  }

  console.log(
    `Seed done:\n  goal=${goal.title} (${goal.id})\n  agent key: ${LOCAL_AGENT_KEY}`
  );
}

async function findGoalId(title: string): Promise<string | null> {
  const goal = await prisma.goal.findFirst({ where: { title }, select: { id: true } });
  return goal?.id ?? null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
