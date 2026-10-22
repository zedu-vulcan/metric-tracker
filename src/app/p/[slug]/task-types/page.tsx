import { redirect } from "next/navigation";
import { TaskTypesView } from "@/components/task-types/TaskTypesView";
import { projectHref } from "@/lib/project-paths";
import { getProjectPage } from "@/lib/project-page";
import { hasRole } from "@/lib/projects";

/** Project owners and admins only; members are sent back to the project's tasks. */
export default async function TaskTypesPage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);
  if (!hasRole(project.role, "admin")) redirect(projectHref(project.slug, "/tasks"));

  return <TaskTypesView />;
}
