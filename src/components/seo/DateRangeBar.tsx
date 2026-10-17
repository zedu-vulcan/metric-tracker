"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RANGE_PRESETS, addDays, validateRange, type RangeKey, type RangePreset } from "@/lib/seo/dates";
import type { DateRange } from "@/lib/seo/types";

const OPTIONS: { key: RangeKey; label: string; longLabel: string }[] = [
  ...RANGE_PRESETS,
  { key: "custom", label: "Custom", longLabel: "Custom range" },
];

interface DateRangeBarProps {
  value: RangeKey;
  /** The range currently applied (for prefilling the custom inputs). */
  applied: DateRange | null;
  today: string;
  onPreset: (preset: RangePreset) => void;
  onCustom: (range: DateRange) => void;
}

export function DateRangeBar({ value, applied, today, onPreset, onCustom }: DateRangeBarProps) {
  const [customOpen, setCustomOpen] = useState(value === "custom");
  const [draft, setDraft] = useState<DateRange>(applied ?? { startDate: addDays(today, -28), endDate: addDays(today, -1) });
  const [draftError, setDraftError] = useState<string | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const selected: RangeKey = customOpen ? "custom" : value;
  const latest = addDays(today, -1);

  const choose = (key: RangeKey) => {
    if (key === "custom") {
      if (applied) setDraft(applied);
      setDraftError(null);
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onPreset(key);
  };

  // Radio-group keyboard pattern: arrows move and select.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + OPTIONS.length) % OPTIONS.length;
    buttons.current[next]?.focus();
    choose(OPTIONS[next].key);
  };

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateRange(draft, latest);
    setDraftError(problem);
    if (!problem) onCustom(draft);
  };

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
      <div
        role="radiogroup"
        aria-label="Date range"
        className="inline-flex h-8.5 items-center gap-0.5 rounded-lg border bg-card p-0.5"
      >
        {OPTIONS.map((option, index) => {
          const checked = selected === option.key;
          return (
            <button
              key={option.key}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.longLabel}
              tabIndex={checked ? 0 : -1}
              onClick={() => choose(option.key)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "inline-flex h-full min-w-11 items-center justify-center rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                checked && "bg-accent text-primary-deep hover:text-primary-deep",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {customOpen && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-2" aria-label="Custom date range" noValidate>
          <Field className="w-auto" data-invalid={draftError ? true : undefined}>
            <FieldLabel htmlFor="seo-range-start" className="text-xs">
              From
            </FieldLabel>
            <Input
              id="seo-range-start"
              type="date"
              value={draft.startDate}
              max={draft.endDate || latest}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              aria-invalid={draftError ? true : undefined}
              className="h-8.5 w-38 font-mono"
              required
            />
          </Field>
          <Field className="w-auto" data-invalid={draftError ? true : undefined}>
            <FieldLabel htmlFor="seo-range-end" className="text-xs">
              To
            </FieldLabel>
            <Input
              id="seo-range-end"
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              max={latest}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              aria-invalid={draftError ? true : undefined}
              className="h-8.5 w-38 font-mono"
              required
            />
          </Field>
          <Button type="submit" variant="outline">
            Apply
          </Button>
          {draftError && <FieldError className="basis-full text-xs">{draftError}</FieldError>}
        </form>
      )}
    </div>
  );
}
