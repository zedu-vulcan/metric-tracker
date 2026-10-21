import { ScoreboardView } from "@/components/scoreboard/ScoreboardView";
import { getProjectPage } from "@/lib/project-page";

export default async function ScoreboardPage({ params }: { params: { slug: string } }) {
  const { session, userId } = await getProjectPage(params.slug);
  return <ScoreboardView currentUser={{ id: userId, name: session.user?.name ?? "You" }} />;
}
