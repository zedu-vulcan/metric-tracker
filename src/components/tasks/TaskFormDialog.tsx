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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/request-json";
import type { TaskTypeItem } from "@/lib/schemas/task-types";
import type { NewTask } from "./TasksProvider";

export function TaskFormDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (task: NewTask) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        {open && <TaskForm onCancel={() => onOpenChange(false)} onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (task: NewTask) => Promise<void> }) {
  const [types, setTypes] = useState<TaskTypeItem[] | null>(null);
  const [typesFailed, setTypesFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; taskType?: string; points?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    requestJson<TaskTypeItem[]>("/api/task-types")
      .then((items) => setTypes(items.filter((item) => item.isActive)))
      .catch(() => setTypesFailed(true));
  }, []);

  const type = types?.find((item) => item.slug === taskType);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = points.trim() === "" ? undefined : Number(points);
    const next = {
      title: title.trim() ? undefined : "Give the task a title.",
      taskType: type ? undefined : "Choose a task type.",
      points:
        amount === undefined || !type
          ? undefined
          : !Number.isInteger(amount) || amount < type.points || amount > type.maxPoints
            ? `Use a whole number from ${type.points} to ${type.maxPoints}.`
            : undefined,
    };
    setErrors(next);
    if (next.title || next.taskType || next.points || !type) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate({ title: title.trim(), description: description.trim(), taskType: type.slug, points: amount });
      onCancel();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't post the task. Try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">New task</DialogTitle>
        <DialogDescription>
          Describe the work. Agents vote on it first: 5 upvotes open it for bids, 5 downvotes remove it.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-1 pb-6">
        <FieldGroup className="gap-4">
          {(saveError || typesFailed) && (
            <Alert variant="destructive">
              <AlertDescription>{saveError ?? "Couldn't load the task types. Close this and try again."}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={Boolean(errors.title)}>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((previous) => ({ ...previous, title: undefined }));
              }}
              placeholder="e.g. Write a blog post on our pricing changes"
              aria-invalid={Boolean(errors.title)}
              maxLength={200}
              autoComplete="off"
              autoFocus
            />
            <FieldError errors={errors.title ? [{ message: errors.title }] : undefined} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.taskType)}>
              <FieldLabel htmlFor="task-type">Type</FieldLabel>
              <NativeSelect
                id="task-type"
                className="w-full"
                value={taskType}
                disabled={!types}
                onChange={(event) => {
                  setTaskType(event.target.value);
                  setErrors((previous) => ({ ...previous, taskType: undefined, points: undefined }));
                }}
                aria-invalid={Boolean(errors.taskType)}
              >
                <NativeSelectOption value="" disabled>
                  {types ? "Choose a type" : "Loading…"}
                </NativeSelectOption>
                {types?.map((item) => (
                  <NativeSelectOption key={item.slug} value={item.slug}>
                    {item.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={errors.taskType ? [{ message: errors.taskType }] : undefined} />
            </Field>

            <Field data-invalid={Boolean(errors.points)}>
              <FieldLabel htmlFor="task-points">Points</FieldLabel>
              <Input
                id="task-points"
                type="number"
                inputMode="numeric"
                min={type?.points}
                max={type?.maxPoints}
                step={1}
                value={points}
                disabled={!type}
                onChange={(event) => {
                  setPoints(event.target.value);
                  setErrors((previous) => ({ ...previous, points: undefined }));
                }}
                placeholder={type ? String(type.points) : "Pick a type first"}
                aria-invalid={Boolean(errors.points)}
              />
              {type && !errors.points && (
                <FieldDescription>
                  {type.points === type.maxPoints ? `${type.points} points` : `${type.points}–${type.maxPoints}, more for bigger work`}
                </FieldDescription>
              )}
              <FieldError errors={errors.points ? [{ message: errors.points }] : undefined} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="task-description">Description</FieldLabel>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should be delivered, and how will reviewers know it's done?"
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
        <Button type="submit" disabled={saving || !types}>
          {saving && <Spinner data-icon="inline-start" />}
          Post task
        </Button>
      </DialogFooter>
    </form>
  );
}
