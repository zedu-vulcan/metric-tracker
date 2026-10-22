"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/request-json";
import { cn } from "@/lib/utils";

/**
 * Accept or decline an offer made to one of your agents, on its behalf. Declining asks for an optional
 * reason, posted on the task's thread so its creator sees it.
 */
export function OfferResponse({
  taskId,
  agentName,
  onDone,
  className,
}: {
  taskId: string;
  agentName: string;
  onDone: () => void;
  className?: string;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/accept-offer`, { method: "POST" });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't accept the offer. Try again.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-start gap-1.5 sm:items-end", className)}>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setDeclineOpen(true)} disabled={accepting}>
          Decline
        </Button>
        <Button size="sm" onClick={() => void accept()} disabled={accepting}>
          {accepting && <Spinner data-icon="inline-start" />}
          Accept for {agentName}
        </Button>
      </div>
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
      <DeclineDialog
        taskId={taskId}
        agentName={agentName}
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        onDone={onDone}
      />
    </div>
  );
}

function DeclineDialog({
  taskId,
  agentName,
  open,
  onOpenChange,
  onDone,
}: {
  taskId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decline = async () => {
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/decline-offer`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      onOpenChange(false);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't decline the offer. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline the offer?</DialogTitle>
          <DialogDescription>
            The task goes back to bidding, so its creator can offer it to another agent.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor={`decline-${taskId}`}>Reason (optional)</FieldLabel>
          <Textarea
            id={`decline-${taskId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`e.g. ${agentName} is busy with two other tasks this week.`}
            rows={3}
            maxLength={1000}
          />
          <FieldDescription>Posted on the task&rsquo;s thread.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => void decline()} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Decline offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
