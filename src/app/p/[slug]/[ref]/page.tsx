import { notFound, redirect } from "next/navigation";
import { getProjectPage } from "@/lib/project-page";
import { projectHref } from "@/lib/project-paths";
import { resolveRef } from "@/lib/refs-server";

export const dynamic = "force-dynamic";

/** Short links like `/p/zedu/T-341` open the goal, idea or task the reference points to. */
export default async function RefPage({ params }: { params: { slug: string; ref: string } }) {
  const { project } = await getProjectPage(params.slug);
  const item = await resolveRef(project.id, decodeURIComponent(params.ref));
  if (!item?.path) notFound();
  redirect(projectHref(project.slug, item.path));
}
