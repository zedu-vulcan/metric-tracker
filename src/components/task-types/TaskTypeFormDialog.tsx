"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TaskTypeConfig } from "@/lib/points";
import { slugify, validateTaskTypeForm } from "./task-types-model";

export type SaveOutcome = { ok: true } | { ok: false; error: string };

export function TaskTypeFormDialog({
  open,
  onOpenChange,
  initial,
  existing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The type being edited, or null to add a new one. */
  initial: TaskTypeConfig | null;
  existing: TaskTypeConfig[];
  onSave: (type: TaskTypeConfig) => Promise<SaveOutcome>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        {open && (
          <TaskTypeForm
            initial={initial}
            existing={existing}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskTypeForm({
  initial,
  existing,
  onCancel,
  onSave,
}: {
  initial: TaskTypeConfig | null;
  existing: TaskTypeConfig[];
  onCancel: () => void;
  onSave: (type: TaskTypeConfig) => Promise<SaveOutcome>;
}) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [points, setPoints] = useState(initial ? String(initial.points) : "");
  const [maxPoints, setMaxPoints] = useState(initial ? String(initial.maxPoints) : "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const pointsNum = points.trim() === "" ? Number.NaN : Number(points);
    const maxNum = maxPoints.trim() === "" ? Number.NaN : Number(maxPoints);
    const formErrors = validateTaskTypeForm(
      { slug: slug.trim(), points: pointsNum, maxPoints: maxNum },
      existing,
      initial?.id
    );
    if (!name.trim()) formErrors.unshift("Name is required.");
    setErrors(formErrors);
    setServerError("");
    if (formErrors.length > 0) return;

    setSaving(true);
    const outcome = await onSave({
      id: initial?.id ?? `tt_${slug.trim() || "custom"}`,
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim() || null,
      points: pointsNum,
      maxPoints: maxNum,
      isActive,
    });
    setSaving(false);

    if (outcome.ok) {
      onCancel();
    } else {
      setServerError(outcome.error);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">
          {editing ? "Edit task type" : "Add task type"}
        </DialogTitle>
        <DialogDescription>
          Task types set the points an agent earns. A change applies to future tasks only.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {editing && (
          <Alert>
            <AlertDescription>
              Editing points doesn&apos;t change work already in flight — each open task keeps the points it was created with.
            </AlertDescription>
          </Alert>
        )}

        <FieldGroup className="gap-4">
          <Field data-invalid={errors.length > 0 && !name.trim()}>
            <FieldLabel htmlFor="task-type-name">Name</FieldLabel>
            <Input
              id="task-type-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
                setErrors([]);
              }}
              placeholder="e.g. Content"
              aria-invalid={errors.length > 0 && !name.trim()}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
          </Field>

          <Field data-invalid={errors.length > 0}>
            <FieldLabel htmlFor="task-type-slug">Slug</FieldLabel>
            <Input
              id="task-type-slug"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
                setErrors([]);
              }}
              placeholder="e.g. content"
              className="font-mono"
              aria-invalid={errors.length > 0}
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={errors.length > 0}>
              <FieldLabel htmlFor="task-type-points">Default points</FieldLabel>
              <Input
                id="task-type-points"
                value={points}
                onChange={(event) => {
                  setPoints(event.target.value);
                  setErrors([]);
                }}
                inputMode="numeric"
                placeholder="0"
                aria-invalid={errors.length > 0}
              />
            </Field>

            <Field data-invalid={errors.length > 0}>
              <FieldLabel htmlFor="task-type-max">Max points</FieldLabel>
              <Input
                id="task-type-max"
                value={maxPoints}
                onChange={(event) => {
                  setMaxPoints(event.target.value);
                  setErrors([]);
                }}
                inputMode="numeric"
                placeholder="0"
                aria-invalid={errors.length > 0}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="task-type-description">Description</FieldLabel>
            <Textarea
              id="task-type-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What kind of work this covers."
              rows={3}
              maxLength={300}
            />
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="task-type-active"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              label="Active"
            />
          </Field>

          {errors.length > 0 && <FieldError errors={errors.map((message) => ({ message }))} />}
        </FieldGroup>
      </div>

      <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {editing ? "Save changes" : "Add task type"}
        </Button>
      </DialogFooter>
    </form>
  );
}
