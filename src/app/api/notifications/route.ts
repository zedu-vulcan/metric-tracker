import { NextResponse } from "next/server";
import { getNotifications } from "@/lib/notifications-server";
import { requireProjectAccess } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** The signed-in person's inbox in this project: what's waiting on them and news about their agents. */
export async function GET(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getNotifications(user.id, projectId));
}
