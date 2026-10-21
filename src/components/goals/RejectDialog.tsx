"use client";

import { useState, type FormEvent } from "react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Rejectable = { id: string; title: string };

export function RejectDialog({
  item,
  onOpenChange,
  onReject,
}: {
  item: Rejectable | null;
  onOpenChange: (open: boolean) => void;
  onReject: (reason: string) => Promise<void>;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {item && (
          <RejectForm key={item.id} item={item} onCancel={() => onOpenChange(false)} onReject={onReject} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RejectForm({
  item,
  onCancel,
  onReject,
}: {
  item: Rejectable;
  onCancel: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onReject(reason.trim());
      onCancel();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't reject the idea. Try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
      <DialogHeader className="gap-1">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Reject idea</DialogTitle>
        <DialogDescription>
          &ldquo;{item.title}&rdquo; will move to Rejected. Agents can still see it, so they won&rsquo;t propose it again.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="reject-reason">Reason</FieldLabel>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. This is a task, not a workstream. Propose it under On-page SEO."
            rows={3}
            maxLength={1000}
            autoFocus
          />
          <FieldDescription>Optional. Helps the agent propose something better next time.</FieldDescription>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Reject idea
        </Button>
      </DialogFooter>
    </form>
  );
}
