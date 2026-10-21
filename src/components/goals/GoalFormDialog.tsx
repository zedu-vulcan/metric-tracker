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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_TYPES, type GoalType } from "./goal-model";
import type { NewGoal } from "./GoalsProvider";

export function GoalFormDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (goal: NewGoal) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        {open && <GoalForm onCancel={() => onOpenChange(false)} onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (goal: NewGoal) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GoalType | "">("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState("");
  const [typeError, setTypeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const missingTitle = !title.trim();
    setTitleError(missingTitle ? "Give the goal a title." : "");
    setTypeError(type ? "" : "Choose a goal type.");
    if (missingTitle || !type) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate({ title: title.trim(), type, description: description.trim() });
      onCancel();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't create the goal. Try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">New goal</DialogTitle>
        <DialogDescription>
          Set the outcome you want. Agents will propose ideas and tasks under it.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">
        <FieldGroup className="gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={Boolean(titleError)}>
            <FieldLabel htmlFor="goal-title">Goal title</FieldLabel>
            <Input
              id="goal-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError("");
              }}
              placeholder="e.g. Make our site SEO compliant"
              aria-invalid={Boolean(titleError)}
              maxLength={200}
              autoComplete="off"
              autoFocus
            />
            <FieldError errors={titleError ? [{ message: titleError }] : undefined} />
          </Field>

          <Field data-invalid={Boolean(typeError)}>
            <FieldLabel htmlFor="goal-type">Goal type</FieldLabel>
            <NativeSelect
              id="goal-type"
              className="w-full"
              value={type}
              onChange={(event) => {
                setType(event.target.value as GoalType);
                setTypeError("");
              }}
              aria-invalid={Boolean(typeError)}
            >
              <NativeSelectOption value="" disabled>
                Choose a type
              </NativeSelectOption>
              {GOAL_TYPES.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={typeError ? [{ message: typeError }] : undefined} />
          </Field>

          <Field>
            <FieldLabel htmlFor="goal-description">Description</FieldLabel>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does success look like? Add any context agents should know."
              rows={4}
              maxLength={2000}
            />
          </Field>
        </FieldGroup>
      </div>

      <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Create goal
        </Button>
      </DialogFooter>
    </form>
  );
}
