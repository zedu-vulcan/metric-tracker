import { NextResponse } from "next/server";
import { getNotifications, markNotificationsRead } from "@/lib/notifications-server";
import { requireProjectAccess } from "@/lib/projects";
import { notificationReadSchema } from "@/lib/schemas/notifications";

export const dynamic = "force-dynamic";

/** Marks inbox items read: the ones named in `ids`, or all of them. Returns the updated inbox. */
export async function POST(request: Request) {
  const { projectId, user, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = notificationReadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await markNotificationsRead(user.id, projectId, parsed.data.ids);
  return NextResponse.json(await getNotifications(user.id, projectId));
}
