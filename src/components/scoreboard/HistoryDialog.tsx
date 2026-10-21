"use client";

import { useCallback, useEffect, useState } from "react";
import { HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { REASON_LABELS, type PointReason } from "@/lib/points";
import type { PointsHistoryEntry } from "@/lib/schemas/scoreboard";
import { cn } from "@/lib/utils";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason as PointReason] ?? reason;
}

function sign(amount: number): string {
  return amount > 0 ? "+" : "−";
}

const PAGE_SIZE = 20;

export function HistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [entries, setEntries] = useState<PointsHistoryEntry[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (target: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/me/points?page=${target}&limit=${PAGE_SIZE}`);
        if (!response.ok) throw new Error(`Failed to load history (${response.status})`);
        const data = (await response.json()) as {
          entries: PointsHistoryEntry[];
          balance: number;
          pagination: { total: number };
        };
        setBalance(data.balance);
        setTotal(data.pagination.total);
        setPage(target);
        setEntries((previous) => (target === 1 ? data.entries : [...previous, ...data.entries]));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load history.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      setEntries([]);
      setBalance(null);
      setTotal(0);
      void loadPage(1);
    }
  }, [open, loadPage]);

  const hasMore = entries.length < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My points history</DialogTitle>
          <DialogDescription>
            {balance != null ? `Balance: ${balance.toLocaleString("en-GB")} pts · ` : ""}
            Ledger entries, newest first. Times are in Lagos (Africa/Lagos).
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {entries.length === 0 && !loading && !error && <p className="py-6 text-center text-sm text-muted-foreground">No points earned yet.</p>}

        {entries.length === 0 && loading && (
          <div className="flex flex-col gap-3 py-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-12 w-full animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <ul className="m-0 flex max-h-[60vh] list-none flex-col divide-y divide-border overflow-y-auto p-0">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-deep">
                  <HistoryIcon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-foreground">{reasonLabel(entry.reason)}</span>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        entry.amount > 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {sign(entry.amount)}
                      {Math.abs(entry.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.source_type && (
                      <span className="capitalize">{entry.source_type}</span>
                    )}
                    {entry.source_id && <span className="font-mono"> {entry.source_id}</span>}
                    {entry.source_type || entry.source_id ? " · " : ""}
                    {dateTime.format(new Date(entry.created_at))}
                  </p>
                  {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button variant="outline" size="sm" onClick={() => void loadPage(page + 1)} disabled={loading}>
              {loading && <Spinner data-icon="inline-start" />}
              Load more
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
