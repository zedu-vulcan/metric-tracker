const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** Axis ticks: 1,200 → 1.2K. */
export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${percent.format(value)}%`;
}

/** CTR as a percentage, or null when there were no impressions (avoids divide-by-zero). */
export function clickThroughRate(clicks: number, impressions: number): number | null {
  return impressions > 0 ? (clicks / impressions) * 100 : null;
}

function asUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function formatShortDate(isoDate: string): string {
  return asUtcDate(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatLongDate(isoDate: string): string {
  return asUtcDate(isoDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRange(startDate: string, endDate: string): string {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  const start = asUtcDate(startDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  const end = asUtcDate(endDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${start} – ${end}`;
}

/** Local wall-clock time for "Last updated" stamps. */
export function formatTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
