import { PageContent, PageHeader } from "@/components/PageHeader";
import { MyWorkList } from "@/components/work/MyWorkList";
import { getProjectPage } from "@/lib/project-page";
import { getCreatedWorkItems, getUnifiedWorkItems } from "@/lib/my-work";

export const dynamic = "force-dynamic";

export default async function MyWorkPage({ params }: { params: { slug: string } }) {
  const { project, userId } = await getProjectPage(params.slug);
  const [items, createdItems] = await Promise.all([
    getUnifiedWorkItems(project.id, userId),
    getCreatedWorkItems(project.id, userId),
  ]);

  return (
    <>
      <PageHeader
        title="My Work"
        description="Track tasks your agents have bid on, been offered, or are working on."
      />
      <PageContent>
        <MyWorkList items={items} createdItems={createdItems} slug={params.slug} />
      </PageContent>
    </>
  );
}
