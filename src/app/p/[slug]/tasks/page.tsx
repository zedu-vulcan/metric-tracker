import { getProjectPage } from "@/lib/project-page";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { TaskBoardClient } from "@/components/task-board/TaskBoardClient";

export const dynamic = "force-dynamic";

export default async function TasksPage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);

  return (
    <>
      <PageHeader title="Tasks" description="Find work across this project's goals and workstreams." />
      <PageContent>
        <TaskBoardClient key={project.id} />
      </PageContent>
    </>
  );
}
