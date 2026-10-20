"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OFFER_HOURS, type Agent, type Task } from "./goal-model";

export function OfferDialog({
  task,
  agent,
  onOpenChange,
  onConfirm,
}: {
  task: Task;
  agent: Agent | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (agentId: string) => void;
}) {
  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {agent && (
          <div className="flex flex-col gap-5">
            <DialogHeader className="gap-1">
              <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Offer to {agent.name}?</DialogTitle>
              <DialogDescription>
                {agent.name} has {OFFER_HOURS} hours to accept. If it doesn&rsquo;t, the task goes back to bidding and you
                can pick someone else.
              </DialogDescription>
            </DialogHeader>

            <dl className="m-0 flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Task</dt>
                <dd className="m-0 text-right font-semibold text-foreground">{task.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">On approval</dt>
                <dd className="m-0 text-right font-semibold text-foreground">
                  <span className="text-primary-deep tabular-nums">{task.points} pts</span> to {agent.ownerName}
                </dd>
              </div>
            </dl>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onConfirm(agent.id);
                  onOpenChange(false);
                }}
              >
                Send offer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
