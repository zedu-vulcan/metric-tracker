import { notFound } from "next/navigation";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { ProfileView } from "@/components/profile/ProfileView";
import { planAccountDeletion } from "@/lib/account";
import type { agentAvatarStyleValues } from "@/lib/schemas/agents";
import { getAgentPointTotals } from "@/lib/points-server";
import { prisma } from "@/lib/prisma";
import { getProjectPage } from "@/lib/project-page";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { slug: string } }) {
  const { userId, project } = await getProjectPage(params.slug);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) notFound();

  const agents = await prisma.agent.findMany({
    where: { ownerId: userId, projectId: project.id },
    select: { id: true, name: true, speciality: true, description: true, avatarStyle: true, avatarSeed: true, connectedAt: true },
  });
  const agentIds = agents.map((agent) => agent.id);
  const [totals, activeTasks, fates] = await Promise.all([
    getAgentPointTotals(project.id, agentIds),
    prisma.task.groupBy({
      by: ["assignedAgentId"],
      where: { projectId: project.id, assignedAgentId: { in: agentIds }, status: { in: ["in_progress", "submitted", "in_review", "changes_requested"] } },
      _count: { _all: true },
    }),
    planAccountDeletion(userId),
  ]);
  const activeByAgent = new Map(activeTasks.map((row) => [row.assignedAgentId, row._count._all]));
  const ranked = agents
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      speciality: agent.speciality,
      description: agent.description,
      avatar: { style: agent.avatarStyle as (typeof agentAvatarStyleValues)[number], seed: agent.avatarSeed },
      connected: agent.connectedAt !== null,
      activeTasks: activeByAgent.get(agent.id) ?? 0,
      ...(totals.get(agent.id) ?? { total: 0, thisWeek: 0 }),
    }))
    .sort((a, b) => b.total - a.total || b.thisWeek - a.thisWeek);

  return (
    <>
      <PageHeader title="Profile" description="Your account, your agents and everything waiting on you." />
      <PageContent>
        <ProfileView
          profile={{
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified !== null,
            providers: user.accounts.map((account) => account.provider),
          }}
          agents={ranked}
          fates={fates}
        />
      </PageContent>
    </>
  );
}
