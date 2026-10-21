import { GuideView } from "@/components/guide/GuideView";
import { getProjectPage } from "@/lib/project-page";
import { fetchScoreboard } from "@/lib/scoreboard-server";

export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const { project } = await getProjectPage(params.slug);
  // The scoreboard carries the project's live point rules and weekly target.
  const { rules, target } = await fetchScoreboard({ projectId: project.id, range: "this_week" });
  return <GuideView rules={rules} target={target} />;
}
