import type { DateRange } from "./types";

// Calendar-date helpers. Dates are plain YYYY-MM-DD strings handled in UTC so
// that arithmetic never shifts a day because of the viewer's time zone.

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Search Console keeps 16 months of data; cap every range there. */
export const MAX_RANGE_DAYS = 486;

export type RangePreset = "7d" | "28d" | "3m";
export type RangeKey = RangePreset | "custom";

export const RANGE_PRESETS: { key: RangePreset; label: string; longLabel: string }[] = [
  { key: "7d", label: "7D", longLabel: "Last 7 days" },
  { key: "28d", label: "28D", longLabel: "Last 28 days" },
  { key: "3m", label: "3M", longLabel: "Last 3 months" },
];

export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || toIsoDate(date) !== value ? null : date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Every date from start to end, inclusive. */
export function eachDate(range: DateRange): string[] {
  const dates: string[] = [];
  for (let d = range.startDate; d <= range.endDate; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** Today's calendar date in the viewer's local time zone. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Presets cover complete days and end yesterday, because neither Google Search
 * Console nor GA4 has a finished day for today.
 */
export function resolvePreset(preset: RangePreset, today: string): DateRange {
  const endDate = addDays(today, -1);
  if (preset === "7d") return { startDate: addDays(endDate, -6), endDate };
  if (preset === "28d") return { startDate: addDays(endDate, -27), endDate };

  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 3);
  return { startDate: addDays(toIsoDate(start), 1), endDate };
}

/** Returns an error message, or null when the range is usable. */
export function validateRange(range: DateRange, today: string): string | null {
  if (!parseIsoDate(range.startDate) || !parseIsoDate(range.endDate)) return "Use dates in the format YYYY-MM-DD.";
  if (range.startDate > range.endDate) return "The start date must be on or before the end date.";
  if (range.endDate > today) return "The end date can't be in the future.";
  if (daysBetween(range.startDate, range.endDate) + 1 > MAX_RANGE_DAYS) {
    return "Choose a range of 16 months or less (Search Console's retention limit).";
  }
  return null;
}
