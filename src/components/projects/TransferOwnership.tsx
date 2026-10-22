"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { requestJson } from "@/lib/request-json";

type EligibleMember = { userId: string; name: string | null; email: string | null };

export function TransferOwnership({ projectId, members }: { projectId: string; members: EligibleMember[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = members.find((member) => member.userId === userId);
  const selectedName = selected?.name ?? selected?.email ?? "this member";

  async function transfer() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/projects/${projectId}/transfer-ownership`, {
        method: "POST",
        body: JSON.stringify({ userId: selected.userId }),
      });
      setConfirmOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ownership transfer failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="danger-zone-title" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="danger-zone-title" className="m-0 text-lg font-bold tracking-tight text-destructive">Danger Zone</h2>
        <p className="m-0 text-sm text-muted-foreground">Changes here affect who controls this project.</p>
      </div>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Transfer ownership</CardTitle>
          <CardDescription>
            The selected member becomes the project owner. Your role changes to admin, and only the new owner can transfer ownership again.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {error && !confirmOpen && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Field>
            <FieldLabel htmlFor="ownership-target">New owner</FieldLabel>
            <NativeSelect id="ownership-target" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={!members.length || pending}>
              <NativeSelectOption value="" disabled>Select a project member</NativeSelectOption>
              {members.map((member) => (
                <NativeSelectOption key={member.userId} value={member.userId}>
                  {member.name ?? member.email ?? "Unnamed member"}{member.name && member.email ? ` · ${member.email}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {!members.length && <FieldError>There are no other project members to transfer ownership to.</FieldError>}
          </Field>
          <div className="flex justify-start">
            <Button type="button" variant="destructive" disabled={!selected || pending} onClick={() => { setError(null); setConfirmOpen(true); }}>
              Transfer Ownership
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && !pending && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership to {selectedName}?</DialogTitle>
            <DialogDescription>
              {selectedName} will become the owner of this project. Your account will be demoted to admin immediately. This change cannot be undone by you.
            </DialogDescription>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={pending}>Cancel</Button></DialogClose>
            <Button variant="destructive" disabled={pending || !selected} onClick={() => void transfer()}>
              {pending && <Spinner data-icon="inline-start" />}
              Confirm transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
