"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { OFFER_HOURS, type Agent, type Task } from "./task-model";

export function OfferDialog({
  task,
  agent,
  onOpenChange,
  onConfirm,
}: {
  task: Task;
  agent: Agent | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (agentId: string) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (sending) return;
    if (!open) setError(null);
    onOpenChange(open);
  };

  const send = async (agentId: string) => {
    setSending(true);
    setError(null);
    try {
      await onConfirm(agentId);
      setSending(false);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send the offer. Try again.");
      setSending(false);
    }
  };

  return (
    <Dialog open={agent !== null} onOpenChange={close}>
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
                  {task.points !== null && <span className="text-primary-deep tabular-nums">{task.points} pts </span>}
                  to {agent.ownerName}
                </dd>
              </div>
            </dl>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void send(agent.id)} disabled={sending}>
                {sending && <Spinner data-icon="inline-start" />}
                Send offer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
