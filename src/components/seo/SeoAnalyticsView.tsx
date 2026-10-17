"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { localToday, resolvePreset, validateRange, addDays, type RangeKey, type RangePreset } from "@/lib/seo/dates";
import { formatTime } from "@/lib/seo/format";
import type { DateRange, SearchPerformanceResponse, TrafficChannelsResponse } from "@/lib/seo/types";
import { ClicksImpressionsChart } from "./ClicksImpressionsChart";
import { DateRangeBar } from "./DateRangeBar";
import { TrafficChannelsChart } from "./TrafficChannelsChart";
import { useSeoReport, type RefreshSignal } from "./useSeoReport";

const PRESETS: RangeKey[] = ["7d", "28d", "3m", "custom"];
const AUTO_REFRESH_KEY = "seo-analytics:auto-refresh";
const AUTO_REFRESH_OPTIONS = [
  { value: "0", label: "Auto-refresh off" },
  { value: "5", label: "Every 5 min" },
  { value: "15", label: "Every 15 min" },
];

function readRange(params: URLSearchParams, today: string): { key: RangeKey; range: DateRange } {
  const raw = params.get("range");
  const key: RangeKey = PRESETS.includes(raw as RangeKey) ? (raw as RangeKey) : "28d";
  if (key === "custom") {
    const range = { startDate: params.get("from") ?? "", endDate: params.get("to") ?? "" };
    if (!validateRange(range, addDays(today, -1))) return { key, range };
    return { key: "28d", range: resolvePreset("28d", today) };
  }
  return { key, range: resolvePreset(key, today) };
}

export function SeoAnalyticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolved after mount: "today" is the viewer's calendar day, not the server's.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);

  const selection = useMemo(
    () => (today ? readRange(new URLSearchParams(searchParams.toString()), today) : null),
    [searchParams, today],
  );
  const range = selection?.range ?? null;

  const [refresh, setRefresh] = useState<RefreshSignal>({ nonce: 0, fresh: false });
  const search = useSeoReport<SearchPerformanceResponse>("/api/seo/search-performance", range, refresh);
  const traffic = useSeoReport<TrafficChannelsResponse>("/api/seo/traffic-channels", range, refresh);
  const isFetching = search.isFetching || traffic.isFetching;

  const refetch = useCallback((fresh: boolean) => setRefresh((r) => ({ nonce: r.nonce + 1, fresh })), []);

  const [autoRefresh, setAutoRefresh] = useState("0");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AUTO_REFRESH_KEY);
      if (saved && AUTO_REFRESH_OPTIONS.some((o) => o.value === saved)) setAutoRefresh(saved);
    } catch {
      // Storage unavailable (private mode): keep the default.
    }
  }, []);

  useEffect(() => {
    const minutes = Number(autoRefresh);
    if (!minutes) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refetch(false);
    }, minutes * 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refetch]);

  const changeAutoRefresh = (value: string) => {
    setAutoRefresh(value);
    try {
      window.localStorage.setItem(AUTO_REFRESH_KEY, value);
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  };

  const setParams = (next: Record<string, string>) => {
    const params = new URLSearchParams(next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // The older of the two fetch times, so the stamp never overstates freshness.
  const lastUpdated = [search.data?.fetchedAt, traffic.data?.fetchedAt]
    .filter((t): t is string => Boolean(t))
    .sort()[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        {today && selection ? (
          <DateRangeBar
            key={selection.key}
            value={selection.key}
            applied={selection.range}
            today={today}
            onPreset={(preset: RangePreset) => setParams({ range: preset })}
            onCustom={(r) => setParams({ range: "custom", from: r.startDate, to: r.endDate })}
          />
        ) : (
          <div className="h-8.5" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {isFetching ? (
              <>
                <Spinner aria-hidden="true" className="size-3" />
                Updating…
              </>
            ) : lastUpdated ? (
              <>
                Last updated <span className="font-mono text-foreground">{formatTime(lastUpdated)}</span>
              </>
            ) : null}
          </span>
          <NativeSelect
            size="sm"
            aria-label="Auto-refresh interval"
            value={autoRefresh}
            onChange={(e) => changeAutoRefresh(e.target.value)}
          >
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => refetch(true)} disabled={!range || isFetching}>
            <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <ClicksImpressionsChart report={search} requestedRange={range} onRetry={() => refetch(true)} />
      <TrafficChannelsChart report={traffic} requestedRange={range} onRetry={() => refetch(true)} />
    </div>
  );
}
