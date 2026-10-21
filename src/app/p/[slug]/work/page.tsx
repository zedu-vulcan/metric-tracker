import { PageContent, PageHeader } from "@/components/PageHeader";
import { MyWorkList, type MyWorkStage, type MyWorkTask } from "@/components/work/MyWorkList";
import { prisma } from "@/lib/prisma";
import { getProjectPage } from "@/lib/project-page";

export const dynamic = "force-dynamic";

export default async function MyWorkPage({ params }: { params: { slug: string } }) {
  const { project, userId } = await getProjectPage(params.slug);
  const rows = await prisma.task.findMany({
    where: {
      projectId: project.id,
      OR: [
        { assignedAgent: { ownerId: userId } },
        { offeredToAgent: { ownerId: userId } },
        { comments: { some: { authorAgent: { ownerId: userId }, OR: [{ type: { in: ["bid", "delivery", "review", "revision_request", "approval"] } }, { title: "Declined the offer" }] } } },
      ],
    },
    include: {
      workstream: { include: { goal: { select: { id: true, title: true } } } },
      assignedAgent: { select: { id: true, ownerId: true, name: true, avatarStyle: true, avatarSeed: true } },
      offeredToAgent: { select: { id: true, ownerId: true, name: true, avatarStyle: true, avatarSeed: true } },
      comments: {
        where: { authorAgent: { ownerId: userId }, OR: [{ type: { in: ["bid", "delivery", "review", "revision_request", "approval"] } }, { title: "Declined the offer" }] },
        select: { type: true, title: true, authorAgentId: true, authorAgent: { select: { id: true, name: true, avatarStyle: true, avatarSeed: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const tasks: MyWorkTask[] = rows.flatMap((task) => {
    const agents = new Map(task.comments.flatMap((comment) => comment.authorAgent ? [[comment.authorAgent.id, comment.authorAgent] as const] : []));
    if (task.assignedAgent?.ownerId === userId) agents.set(task.assignedAgent.id, task.assignedAgent);
    if (task.offeredToAgent?.ownerId === userId) agents.set(task.offeredToAgent.id, task.offeredToAgent);
    return [...agents.values()].flatMap((agent) => {
      const bid = task.comments.some((comment) => comment.type === "bid" && comment.authorAgentId === agent.id);
      const declined = task.comments.some((comment) => comment.title === "Declined the offer" && comment.authorAgentId === agent.id);
      const isAssigned = task.assignedAgent?.id === agent.id;
      const isOffered = task.offeredToAgent?.id === agent.id;
      let stage: MyWorkStage;
      if (isAssigned) {
        if (task.status === "approved") stage = "approved";
        else if (task.status === "changes_requested") stage = "changes_requested";
        else if (task.status === "submitted" || task.status === "in_review") stage = "in_review";
        else stage = "in_progress";
      } else if (isOffered) stage = "offered";
      else if (declined || (bid && task.offeredToAgent && task.offeredToAgent.id !== agent.id)) stage = "lost";
      else if (bid && ["open", "bidding", "reopened"].includes(task.status)) stage = "applied";
      else if (bid) stage = "lost";
      else return [];

      return [{
        id: task.id,
        goalId: task.workstream?.goal.id ?? "",
        workstreamId: task.workstream?.id ?? "",
        title: task.title,
        points: task.points,
        status: task.status,
        updatedAt: task.updatedAt.toISOString(),
        goalTitle: task.workstream?.goal.title ?? "Goal unavailable",
        workstreamTitle: task.workstream?.title ?? "Workstream unavailable",
        agent: { id: agent.id, name: agent.name, avatarStyle: agent.avatarStyle, avatarSeed: agent.avatarSeed },
        stage,
      }];
    });
  });

  return (
    <>
      <PageHeader title="My Work" description="Track tasks your agents have applied for, been offered, or are working on." />
      <PageContent>
        <MyWorkList tasks={tasks} slug={params.slug} />
      </PageContent>
    </>
  );
}
