"use client";

import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { PillSelect, SearchPill, Toolbar, ToolbarGroup } from "@/components/Toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { taskBoardStatusValues } from "@/lib/schemas/task-board";
import type { TaskBoardOptions, TaskBoardQuery } from "@/lib/schemas/task-board";
import {
  clearTaskBoardFilter, getTaskBoardDraftFieldErrors, getTaskBoardFilterChange, getTaskBoardFilterChips,
  getTaskBoardFilterChoices, getTaskBoardFilterDrafts, taskBoardDraftSignature,
} from "@/components/task-board/task-board-filter-state";
import type { TaskBoardFieldErrors, TaskBoardFilterPatch } from "@/components/task-board/task-board-filter-state";

export type TaskBoardFiltersProps = {
  value: TaskBoardQuery;
  options: TaskBoardOptions;
  optionsLoading: boolean;
  optionsError: string | null;
  fieldErrors: TaskBoardFieldErrors;
  onChange(patch: TaskBoardFilterPatch, history: "push" | "replace"): void;
  onReset(): void;
  onRetryOptions(): void;
};

export function TaskBoardFilters({ value, options, optionsLoading, optionsError, fieldErrors, onChange, onReset, onRetryOptions }: TaskBoardFiltersProps) {
  const prefix = useId();
  const [drafts, setDrafts] = useState(() => getTaskBoardFilterDrafts(value));
  const [composing, setComposing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmission = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  const change = getTaskBoardFilterChange(value, drafts);
  const errors: TaskBoardFieldErrors = { ...fieldErrors, ...getTaskBoardDraftFieldErrors(change) };
  const choices = getTaskBoardFilterChoices(value, options, optionsLoading);
  const chips = getTaskBoardFilterChips(value, options);
  const pending = change.success && Object.keys(change.data).length > 0;

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Committed URL changes win over drafts, including Back/Forward and pagination.
  useEffect(() => {
    setDrafts(getTaskBoardFilterDrafts(value));
    lastSubmission.current = null;
  }, [value.q, value.status, value.type, value.goal, value.agent, value.minPoints, value.maxPoints, value.page]);

  useEffect(() => {
    const next = getTaskBoardFilterChange(value, drafts);
    if (composing || !next.success || !Object.keys(next.data).length) return;
    const signature = taskBoardDraftSignature(next.drafts);
    if (lastSubmission.current === signature) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      lastSubmission.current = signature;
      onChangeRef.current(next.data, "replace");
    }, 300);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [drafts.q, drafts.minPoints, drafts.maxPoints, value.q, value.minPoints, value.maxPoints, composing]);

  function cancelPending() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function commit(patch: TaskBoardFilterPatch) {
    cancelPending();
    const next = getTaskBoardFilterChange(value, drafts, patch);
    if (!next.success) return;
    setDrafts(next.drafts);
    lastSubmission.current = taskBoardDraftSignature(next.drafts);
    onChange(next.data, "push");
  }

  function reset() {
    cancelPending();
    const defaults = getTaskBoardFilterDrafts({ q: "", minPoints: undefined, maxPoints: undefined });
    lastSubmission.current = taskBoardDraftSignature(defaults);
    setDrafts(defaults);
    setComposing(false);
    onReset();
  }

  const selectors = [
    { key: "status" as const, label: "Status", selected: value.status, defaultValue: "open_for_bids", disabled: false,
      select: (selected: string) => { const status = taskBoardStatusValues.find((item) => item === selected); if (status) commit({ status }); } },
    { key: "type" as const, label: "Type", selected: value.type ?? "", defaultValue: "", disabled: optionsLoading,
      select: (selected: string) => commit({ type: selected || undefined }) },
    { key: "goal" as const, label: "Goal", selected: value.goal ?? "", defaultValue: "", disabled: optionsLoading,
      select: (selected: string) => commit({ goal: selected || undefined }) },
    { key: "agent" as const, label: "Assigned agent", selected: value.agent ?? "", defaultValue: "", disabled: optionsLoading,
      select: (selected: string) => commit({ agent: selected || undefined }) },
  ];

  return (
    <section aria-label="Task filters" className="flex min-w-0 flex-col gap-3">
      <FieldGroup className="gap-3">
        <Toolbar className="items-start">
          <Field className="w-full md:w-80" data-invalid={Boolean(errors.q?.length)}>
            <FieldLabel htmlFor={`${prefix}-q`} className="sr-only">Search tasks</FieldLabel>
            <SearchPill
              value={drafts.q}
              onChange={(q) => setDrafts((previous) => ({ ...previous, q }))}
              placeholder="Search task titles and descriptions"
              className="md:w-full"
              inputProps={{
                id: `${prefix}-q`, maxLength: 200, "aria-invalid": Boolean(errors.q?.length),
                "aria-describedby": errors.q?.length ? `${prefix}-q-error` : undefined,
                onCompositionStart: () => setComposing(true),
                onCompositionEnd: (event) => { const q = event.currentTarget.value; setComposing(false); setDrafts((previous) => ({ ...previous, q })); },
              }}
            />
            <FieldError id={`${prefix}-q-error`} errors={errors.q?.map((message) => ({ message }))} />
          </Field>
          <Button type="button" variant="outline" onClick={reset}>Reset filters</Button>
        </Toolbar>

        <ToolbarGroup className="mx-0 flex-wrap overflow-x-visible px-0">
          {selectors.map(({ key, label, selected, defaultValue, disabled, select }) => (
            <Field key={key} className="w-auto max-w-full" data-invalid={Boolean(errors[key]?.length)}>
              <PillSelect
                label={label} value={selected} options={choices[key]} defaultValue={defaultValue} onChange={select}
                className="max-w-full [&>span:last-of-type]:min-w-0 [&>span:last-of-type]:truncate"
                selectProps={{ id: `${prefix}-${key}`, disabled, "aria-invalid": Boolean(errors[key]?.length), "aria-describedby": errors[key]?.length ? `${prefix}-${key}-error` : undefined }}
              />
              <FieldError id={`${prefix}-${key}-error`} errors={errors[key]?.map((message) => ({ message }))} />
            </Field>
          ))}
        </ToolbarGroup>

        <div className="flex flex-wrap gap-3">
          {(["minPoints", "maxPoints"] as const).map((key) => (
            <Field key={key} className="w-full sm:w-40" data-invalid={Boolean(errors[key]?.length)}>
              <FieldLabel htmlFor={`${prefix}-${key}`}>{key === "minPoints" ? "Min points" : "Max points"}</FieldLabel>
              <Input
                id={`${prefix}-${key}`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Any"
                value={drafts[key]} onChange={(event) => { const raw = event.currentTarget.value; setDrafts((previous) => ({ ...previous, [key]: raw })); }}
                aria-invalid={Boolean(errors[key]?.length)}
                aria-describedby={`${prefix}-points-help${errors[key]?.length ? ` ${prefix}-${key}-error` : ""}`}
              />
              <FieldError id={`${prefix}-${key}-error`} errors={errors[key]?.map((message) => ({ message }))} />
            </Field>
          ))}
        </div>
        <FieldDescription id={`${prefix}-points-help`}>Use whole numbers from 0 to 2,147,483,647. Both ends are included; leave either bound empty for no limit.</FieldDescription>
        <FieldDescription>Assigned agent filters the worker doing the task. My agents includes all workers you own.</FieldDescription>
      </FieldGroup>

      {optionsLoading && <p role="status" className="text-sm text-muted-foreground">Loading filter choices…</p>}
      {optionsError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load filter choices</AlertTitle>
          <AlertDescription>
            <p>{optionsError}</p>
            <Button type="button" variant="outline" size="sm" disabled={optionsLoading} onClick={onRetryOptions}>Retry choices</Button>
          </AlertDescription>
        </Alert>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {!change.success ? "Fix the marked filters before applying changes. Results still use the last applied filters." : pending ? "Applying filters… Results still use the last applied filters." : ""}
      </p>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex min-w-0 flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key} className="min-w-0 max-w-full">
              <Badge variant="secondary" className="h-auto max-w-full gap-1 py-1 pr-1 pl-3">
                <span className="min-w-0 truncate">{chip.label}</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${chip.label}`} onClick={() => commit(clearTaskBoardFilter(chip.key))}>
                  <XIcon aria-hidden="true" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
