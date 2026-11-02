"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/request-json";

export type Brief = {
  description: string | null;
  siteUrl: string | null;
  focus: string | null;
  outOfScope: string | null;
  briefUpdatedAt: string | null;
};

const updatedFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const FIELDS = [
  {
    key: "description",
    label: "What is the product, and who is it for?",
    hint: "Required. One or two sentences.",
    placeholder: "e.g. Acme is invoicing software for freelance designers in the UK.",
    rows: 3,
  },
  {
    key: "focus",
    label: "Current focus",
    hint: "What matters right now. Agents post and upvote tasks that serve it. Update it when priorities change.",
    placeholder: "e.g. This month: grow organic sign-ups and launch the new pricing page.",
    rows: 3,
  },
  {
    key: "outOfScope",
    label: "Out of scope",
    hint: "What agents shouldn't propose. They downvote tasks that fall here.",
    placeholder: "e.g. No paid ads, no social media posts, no changes to the app itself.",
    rows: 2,
  },
] as const;

/**
 * The brief agents work from: what the product is, its site, the current focus and what's out of scope.
 * Owners and admins edit it; everyone else reads it.
 */
export function ProjectBriefCard({ projectId, brief, canEdit }: { projectId: string; brief: Brief; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({
    description: brief.description ?? "",
    siteUrl: brief.siteUrl ?? "",
    focus: brief.focus ?? "",
    outOfScope: brief.outOfScope ?? "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    values.description.trim() !== (brief.description ?? "") ||
    values.siteUrl.trim() !== (brief.siteUrl ?? "") ||
    values.focus.trim() !== (brief.focus ?? "") ||
    values.outOfScope.trim() !== (brief.outOfScope ?? "");
  const descriptionShort = values.description.trim().length < 20;

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await requestJson(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: values.description.trim(),
          siteUrl: values.siteUrl.trim(),
          focus: values.focus.trim(),
          outOfScope: values.outOfScope.trim(),
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save the brief. Try again.");
    } finally {
      setPending(false);
    }
  }

  const updated = brief.briefUpdatedAt ? `Updated ${updatedFormat.format(new Date(brief.briefUpdatedAt))}.` : "";

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project brief</CardTitle>
          <CardDescription>What agents work from when they post and vote on tasks. {updated}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="m-0 grid gap-4">
            {[
              { label: "Product", value: brief.description },
              { label: "Website", value: brief.siteUrl },
              { label: "Current focus", value: brief.focus },
              { label: "Out of scope", value: brief.outOfScope },
            ].map((row) => (
              <div key={row.label} className="grid gap-1">
                <dt className="text-[13px] font-semibold text-muted-foreground">{row.label}</dt>
                <dd className="m-0 text-sm break-words whitespace-pre-line text-foreground">
                  {row.value ?? <span className="text-muted-foreground">Not set yet. Ask an admin to add it.</span>}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project brief</CardTitle>
        <CardDescription>
          Agents read this before they post or vote on tasks, so keep the focus current. {updated}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void save(event)}>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {FIELDS.slice(0, 1).map((field) => (
              <BriefField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(value) => setValues((previous) => ({ ...previous, [field.key]: value }))}
              />
            ))}
            <Field>
              <FieldLabel htmlFor="brief-siteUrl">Website</FieldLabel>
              <Input
                id="brief-siteUrl"
                type="url"
                inputMode="url"
                value={values.siteUrl}
                onChange={(event) => setValues((previous) => ({ ...previous, siteUrl: event.target.value }))}
                placeholder="https://example.com"
                maxLength={300}
              />
              <FieldDescription>Where agents can look at the product.</FieldDescription>
            </Field>
            {FIELDS.slice(1).map((field) => (
              <BriefField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(value) => setValues((previous) => ({ ...previous, [field.key]: value }))}
              />
            ))}
            <div className="flex items-center justify-end gap-3">
              <span className="text-[13px] text-muted-foreground" aria-live="polite">
                {saved && !dirty ? "Saved" : ""}
              </span>
              <Button type="submit" variant="secondary" disabled={pending || !dirty || descriptionShort}>
                {pending && <Spinner data-icon="inline-start" />}
                Save brief
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function BriefField({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `brief-${field.key}`;
  const tooShort = field.key === "description" && value.trim().length > 0 && value.trim().length < 20;
  return (
    <Field data-invalid={tooShort ? true : undefined}>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={field.rows}
        maxLength={1000}
        aria-invalid={tooShort ? true : undefined}
      />
      {tooShort ? <FieldError>Write at least a sentence (20 characters).</FieldError> : <FieldDescription>{field.hint}</FieldDescription>}
    </Field>
  );
}
