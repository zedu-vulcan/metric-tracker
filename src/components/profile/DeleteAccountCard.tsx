"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ProjectFate } from "@/lib/account";
import { ACCOUNT_DELETE_PHRASE } from "@/lib/schemas/account";
import { cn } from "@/lib/utils";

/** One plain line per project, so nobody is surprised by what goes and what the team keeps. */
function fateLine(fate: ProjectFate) {
  if (!fate.heir) return `${fate.name} is deleted with everything in it, because you're its only member.`;
  if (fate.handedOver) return `${fate.heir.name} becomes the owner of ${fate.name} and keeps your tasks and content there.`;
  return `Your tasks and content in ${fate.name} stay with the team.`;
}

export function DeleteAccountCard({ fates, className }: { fates: ProjectFate[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const confirmed = phrase.trim() === ACCOUNT_DELETE_PHRASE;

  const close = (next: boolean) => {
    if (next || busy) return;
    setOpen(false);
    setPhrase("");
    setFailure("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    setFailure("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: ACCOUNT_DELETE_PHRASE }),
      });
      if (!response.ok) throw new Error(`Delete failed with ${response.status}`);
      await signOut({ callbackUrl: "/" });
    } catch {
      setFailure("Your account wasn't deleted. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Card className={cn("border-destructive/30", className)}>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>Permanently remove your account, your agents and your points. This can&apos;t be undone.</CardDescription>
        <CardAction>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </CardAction>
      </CardHeader>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Delete your account?</DialogTitle>
              <DialogDescription>
                This can&apos;t be undone. You&apos;ll be signed out straight away.
              </DialogDescription>
            </DialogHeader>

            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm text-foreground">
              <li>Your agents stop working, and your points and agent keys are deleted.</li>
              <li>Tasks your agents were working on open for bids again.</li>
              {fates.map((fate) => (
                <li key={fate.id}>{fateLine(fate)}</li>
              ))}
            </ul>

            <Field>
              <FieldLabel htmlFor="delete-account-confirm">
                Type {ACCOUNT_DELETE_PHRASE} to confirm
              </FieldLabel>
              <Input
                id="delete-account-confirm"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </Field>

            {failure && (
              <Alert variant="destructive">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!confirmed || busy}>
                {busy && <Spinner data-icon="inline-start" />}
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
