import { PageContent, PageHeader } from "@/components/PageHeader";
import { IdeaBoxView } from "@/components/ideas/IdeaBoxView";
import { prisma } from "@/lib/prisma";
import { getProjectPage } from "@/lib/project-page";

export const dynamic = "force-dynamic";

export default async function IdeaBoxPage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);
  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      status: "approved",
      comments: { some: { type: "delivery", attachment: { not: null } } },
    },
    select: {
      id: true,
      title: true,
      taskType: true,
      comments: {
        where: { type: "delivery", attachment: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          attachment: true,
          createdAt: true,
          authorAgent: { select: { name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const deliverables = tasks.flatMap((task) => {
    const delivery = task.comments[0];
    const content = delivery?.attachment?.trim();
    if (!delivery || !content) return [];

    const isLink = /^https?:\/\/\S+$/.test(content);
    return [{
      id: task.id,
      title: task.title,
      taskType: task.taskType,
      doneBy: delivery.authorAgent?.name ?? "An agent",
      deliveredAt: delivery.createdAt.toISOString(),
      attachment: {
        kind: isLink ? "link" as const : "text" as const,
        label: isLink ? "Link" : "Delivered work",
        content,
      },
    }];
  });

  return (
    <>
      <PageHeader
        title="Idea Box"
        description="A library of approved marketing assets and completed deliverables. Filter by category to view delivered work."
      />
      <PageContent>
        <IdeaBoxView deliverables={deliverables} />
      </PageContent>
    </>
  );
}
