"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { OutletDetails } from "./press-model";
import { apiFetch } from "@/lib/request-json";

type FormState = {
  name: string;
  website: string;
  contactName: string;
  contactEmail: string;
  tier: "" | "Tier 1" | "Tier 2" | "Tier 3";
  notes: string;
};

const formFromOutlet = (outlet: OutletDetails): FormState => ({
  name: outlet.name,
  website: outlet.website ?? "",
  contactName: outlet.contactName ?? "",
  contactEmail: outlet.contactEmail ?? "",
  tier: outlet.tier ?? "",
  notes: outlet.notes ?? "",
});

export function OutletDetailsDialog({
  outlet,
  open,
  onOpenChange,
  onSaved,
}: {
  outlet: OutletDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (outlet: OutletDetails) => void;
}) {
  const [form, setForm] = useState<FormState | null>(outlet ? formFromOutlet(outlet) : null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string[]>>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(outlet ? formFromOutlet(outlet) : null);
    setError("");
    setFieldErrors({});
  }, [outlet, open]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => (previous ? { ...previous, [key]: value } : previous));
    setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!outlet || !form) return;

    setIsSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await apiFetch(`/api/media/outlets/${outlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          website: form.website.trim() || null,
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          tier: form.tier || null,
          notes: form.notes.trim() || null,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | OutletDetails
        | { error?: string; details?: Partial<Record<keyof FormState, string[]>> }
        | null;
      if (!response.ok) {
        const details = body && "details" in body ? body.details : undefined;
        if (details) setFieldErrors(details);
        setError((body && "error" in body && body.error) || "Couldn't save outlet details. Please try again.");
        return;
      }
      onSaved(body as OutletDetails);
      onOpenChange(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const errorFor = (field: keyof FormState) => fieldErrors[field]?.map((message) => ({ message }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={save} className="flex flex-col gap-5">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Outlet details</DialogTitle>
            <DialogDescription>Keep the team&apos;s media contact information in one place.</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {form && (
            <FieldGroup className="gap-4">
              <Field data-invalid={Boolean(fieldErrors.name)}>
                <FieldLabel htmlFor="outlet-name">Outlet name</FieldLabel>
                <Input
                  id="outlet-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoFocus
                />
                <FieldError errors={errorFor("name")} />
              </Field>
              <Field data-invalid={Boolean(fieldErrors.website)}>
                <FieldLabel htmlFor="outlet-website">Website</FieldLabel>
                <Input
                  id="outlet-website"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={form.website}
                  onChange={(event) => update("website", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.website)}
                />
                <FieldError errors={errorFor("website")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(fieldErrors.contactName)}>
                  <FieldLabel htmlFor="outlet-contact-name">Contact name</FieldLabel>
                  <Input
                    id="outlet-contact-name"
                    value={form.contactName}
                    onChange={(event) => update("contactName", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.contactName)}
                  />
                  <FieldError errors={errorFor("contactName")} />
                </Field>
                <Field data-invalid={Boolean(fieldErrors.contactEmail)}>
                  <FieldLabel htmlFor="outlet-contact-email">Contact email</FieldLabel>
                  <Input
                    id="outlet-contact-email"
                    type="email"
                    inputMode="email"
                    value={form.contactEmail}
                    onChange={(event) => update("contactEmail", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.contactEmail)}
                  />
                  <FieldError errors={errorFor("contactEmail")} />
                </Field>
              </div>
              <Field data-invalid={Boolean(fieldErrors.tier)}>
                <FieldLabel htmlFor="outlet-tier">Tier</FieldLabel>
                <NativeSelect
                  id="outlet-tier"
                  value={form.tier}
                  onChange={(event) => update("tier", event.target.value as FormState["tier"])}
                  aria-invalid={Boolean(fieldErrors.tier)}
                >
                  <NativeSelectOption value="">Not set</NativeSelectOption>
                  <NativeSelectOption value="Tier 1">Tier 1</NativeSelectOption>
                  <NativeSelectOption value="Tier 2">Tier 2</NativeSelectOption>
                  <NativeSelectOption value="Tier 3">Tier 3</NativeSelectOption>
                </NativeSelect>
                <FieldError errors={errorFor("tier")} />
              </Field>
              <Field data-invalid={Boolean(fieldErrors.notes)}>
                <FieldLabel htmlFor="outlet-notes">Notes</FieldLabel>
                <Textarea
                  id="outlet-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.notes)}
                  placeholder="Pitch preferences, editorial focus or follow-up context"
                />
                <FieldError errors={errorFor("notes")} />
              </Field>
            </FieldGroup>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form || isSaving}>
              {isSaving && <Spinner data-icon="inline-start" />}
              {isSaving ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
