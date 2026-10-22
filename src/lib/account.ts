import type { ProjectRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** What happens to one project when someone deletes their account. */
export type ProjectFate = {
  id: string;
  name: string;
  /** Who takes over the person's goals, content and SEO checks. Null when nobody else is in it, so it's deleted. */
  heir: { id: string; name: string } | null;
  /** True when the person owned it and the heir becomes the new owner. */
  handedOver: boolean;
};

const ROLE_ORDER: Record<ProjectRole, number> = { owner: 0, admin: 1, member: 2 };
const ACTIVE_WORK: TaskStatus[] = ["in_progress", "submitted", "in_review", "changes_requested"];

/**
 * Every project the person is in, or has created goals, content or SEO checks in, and who inherits it.
 * The heir is the owner, or when the person is the owner, the longest-serving admin and then member.
 */
export async function planAccountDeletion(userId: string): Promise<ProjectFate[]> {
  const [memberships, goals, content, seoChecks] = await Promise.all([
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true, role: true } }),
    prisma.goal.findMany({ where: { createdById: userId }, select: { projectId: true }, distinct: ["projectId"] }),
    prisma.contentItem.findMany({ where: { userId }, select: { projectId: true }, distinct: ["projectId"] }),
    prisma.seoCheck.findMany({ where: { createdById: userId }, select: { projectId: true }, distinct: ["projectId"] }),
  ]);
  const roles = new Map(memberships.map((membership) => [membership.projectId, membership.role]));
  const projectIds = [...new Set([...roles.keys(), ...[...goals, ...content, ...seoChecks].map((row) => row.projectId)])];

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      name: true,
      members: {
        where: { userId: { not: userId } },
        select: { role: true, joinedAt: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return projects.map((project) => {
    const [next] = [...project.members].sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime()
    );
    return {
      id: project.id,
      name: project.name,
      heir: next ? { id: next.user.id, name: next.user.name ?? next.user.email ?? "A teammate" } : null,
      handedOver: Boolean(next) && roles.get(project.id) === "owner",
    };
  });
}

/**
 * Deletes the person and their agents, sessions and points. Projects nobody else is in go with them; in the rest,
 * ownership, goals, content and SEO checks pass to the heir so the team keeps its work, and the agents' tasks reopen.
 */
export async function deleteAccount(userId: string) {
  const fates = await planAccountDeletion(userId);

  await prisma.$transaction(
    async (tx) => {
      const agents = await tx.agent.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
      const active = await tx.task.findMany({
        where: { assignedAgentId: { in: agents.map((agent) => agent.id) }, status: { in: ACTIVE_WORK } },
        select: { id: true, assignedAgentId: true },
      });
      if (active.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: active.map((task) => task.id) } },
          data: { status: "bidding", assignedAgentId: null, offeredToAgentId: null, offeredAt: null, offerExpiresAt: null },
        });
        const names = new Map(agents.map((agent) => [agent.id, agent.name]));
        await tx.taskComment.createMany({
          data: active.map((task) => ({
            taskId: task.id,
            type: "note" as const,
            title: "Open for bids again",
            body: `${names.get(task.assignedAgentId ?? "") ?? "Its agent"}'s owner deleted their account, so this task is open for bids again.`,
          })),
        });
      }

      // Tasks would otherwise be deleted with their creator.
      await tx.task.updateMany({ where: { userId }, data: { userId: null } });

      for (const fate of fates) {
        if (!fate.heir) {
          await tx.project.delete({ where: { id: fate.id } });
          continue;
        }
        if (fate.handedOver) {
          await tx.projectMember.update({
            where: { projectId_userId: { projectId: fate.id, userId: fate.heir.id } },
            data: { role: "owner" },
          });
        }
        await tx.goal.updateMany({ where: { projectId: fate.id, createdById: userId }, data: { createdById: fate.heir.id } });
        await tx.contentItem.updateMany({ where: { projectId: fate.id, userId }, data: { userId: fate.heir.id } });
        await tx.seoCheck.updateMany({ where: { projectId: fate.id, createdById: userId }, data: { createdById: fate.heir.id } });
      }

      await tx.user.delete({ where: { id: userId } });
    },
    { timeout: 30_000 }
  );
}
