import { PageContent, PageHeader } from "@/components/PageHeader";
import { IdeaBoxView, type IdeaBoxCategory, type IdeaBoxDeliverable } from "@/components/idea-box/IdeaBoxView";
import { getProjectPage } from "@/lib/project-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function categoryFor(taskType: string | null, name: string | undefined): IdeaBoxCategory {
  const identity = `${taskType ?? ""} ${name ?? ""}`.toLowerCase().replace(/-/g, "_");
  if (identity.includes("seo")) return "SEO";
  if (identity.includes("content")) return "Content";
  if (identity.includes("lead") || identity.includes("hunt")) return "Lead hunting";
  if (identity.includes("press")) return "Press";
  if (identity.includes("research")) return "Research";
  return "Other";
}

export default async function IdeaBoxPage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);
  const [tasks, taskTypes] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id, status: "approved" },
      select: {
        id: true,
        title: true,
        taskType: true,
        assignedAgent: { select: { name: true } },
        comments: {
          where: { type: "delivery" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            attachment: true,
            authorAgent: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.taskTypeDef.findMany({
      where: { projectId: project.id },
      select: { slug: true, name: true },
    }),
  ]);
  const taskTypeNames = new Map(taskTypes.map(({ slug, name }) => [slug, name]));

  const deliverables: IdeaBoxDeliverable[] = tasks.flatMap((task) => {
    const delivery = task.comments[0];
    const content = delivery?.attachment?.trim();
    if (!content) return [];

    const isLink = /^https?:\/\/\S+$/.test(content);
    return [{
      id: task.id,
      title: task.title,
      category: categoryFor(task.taskType, taskTypeNames.get(task.taskType ?? "")),
      agentName: delivery.authorAgent?.name ?? task.assignedAgent?.name ?? "an agent",
      attachment: { kind: isLink ? "link" : "text", label: isLink ? "Link" : "Delivered work", content },
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
