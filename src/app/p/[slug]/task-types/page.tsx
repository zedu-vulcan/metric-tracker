import { redirect } from "next/navigation";
import { projectHref } from "@/lib/project-paths";

/** Task types moved into project settings; keep old links and bookmarks working. */
export default function TaskTypesPage({ params }: { params: { slug: string } }) {
  redirect(projectHref(params.slug, "/settings?tab=task-types"));
}
