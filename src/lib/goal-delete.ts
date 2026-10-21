import type { ProjectRole } from "@prisma/client";

/** How long a goal's creator can delete it after creating it. Project owners and admins can delete any time. */
export const GOAL_DELETE_WINDOW_MS = 30 * 60 * 1000;

export type GoalDeleteCheck = { allowed: true } | { allowed: false; reason: string };

export function canDeleteGoal({
  role,
  isCreator,
  createdAt,
  now = new Date(),
}: {
  role: ProjectRole;
  isCreator: boolean;
  createdAt: Date;
  now?: Date;
}): GoalDeleteCheck {
  if (role === "owner" || role === "admin") return { allowed: true };
  if (!isCreator) return { allowed: false, reason: "Only the goal's creator or a project admin can delete it" };
  if (now.getTime() - createdAt.getTime() > GOAL_DELETE_WINDOW_MS) {
    return { allowed: false, reason: "Goals can only be deleted in the first 30 minutes. Ask a project admin to delete it" };
  }
  return { allowed: true };
}
