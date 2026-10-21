import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ScoreboardView } from "@/components/scoreboard/ScoreboardView";
import { authOptions } from "@/lib/auth";

export default async function ScoreboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "current_user";
  return <ScoreboardView currentUser={{ id: userId, name: session.user.name ?? "You" }} />;
}
