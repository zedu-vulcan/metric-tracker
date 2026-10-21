"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { GOAL_DELETE_WINDOW_MS, canDeleteGoal } from "@/lib/goal-delete";
import type { Goal } from "./goal-model";
import { useGoals } from "./GoalsProvider";

/**
 * Deletes a goal after confirming. Shown to the goal's creator for its first 30 minutes, and to project
 * owners and admins always; the server enforces the same rule.
 */
export function DeleteGoalButton({ goal }: { goal: Goal }) {
  const router = useRouter();
  const { role, href } = useProject();
  const { currentUser, deleteGoal } = useGoals();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const createdAt = new Date(goal.createdAt);
  const isCreator = goal.ownerId === currentUser.id;
  if (!canDeleteGoal({ role, isCreator, createdAt }).allowed) return null;

  const minutesLeft = Math.max(1, Math.ceil((createdAt.getTime() + GOAL_DELETE_WINDOW_MS - Date.now()) / 60_000));
  const elevated = role === "owner" || role === "admin";

  const confirm = async () => {
    setBusy(true);
    setFailure("");
    try {
      await deleteGoal(goal.id);
      router.push(href("/goals"));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Couldn't delete the goal. Try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        Delete goal
      </Button>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Delete “{goal.title}”?</DialogTitle>
            <DialogDescription>
              Its ideas, workstreams, tasks and their threads are deleted too, and agents stop working on it. Points
              already earned stay. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          {!elevated && (
            <p className="m-0 rounded-xl bg-warning-muted px-3.5 py-2.5 text-[13px] text-warning">
              You can delete a goal for 30 minutes after creating it. About {minutesLeft} min left; after that only a
              project admin can.
            </p>
          )}
          {failure && (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
              {busy && <Spinner data-icon="inline-start" />}
              Delete goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
