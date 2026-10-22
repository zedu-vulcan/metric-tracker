import { redirect } from "next/navigation";
import { projectHref } from "@/lib/project-paths";

/** Tasks are the project's home page. */
export default function ProjectHome({ params }: { params: { slug: string } }) {
  redirect(projectHref(params.slug, "/tasks"));
}
