import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { projectHref } from "@/lib/project-paths";
import { listUserProjects } from "@/lib/projects";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

/** Where sign-in lands: the last project you had open, your first project, or creating one. */
export default async function DashboardRedirect() {
  const userId = await sessionUserId();
  if (!userId) redirect("/");

  const projects = await listUserProjects(userId);
  if (projects.length === 0) redirect("/projects/join");

  const last = cookies().get("zedu_project")?.value;
  const target = projects.find(({ project }) => project.slug === last) ?? projects[0];
  redirect(projectHref(target.project.slug));
}
