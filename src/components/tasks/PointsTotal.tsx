"use client";

import { useCallback, useEffect, useState } from "react";
import { TrophyIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/request-json";

/** The signed-in user's all-time points balance, from the points ledger. `null` until it loads. */
export function usePointsBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    requestJson<{ balance: number }>("/api/me/points?limit=1")
      .then((result) => {
        setBalance(result.balance);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  // Points are released while the tab is in the background, so refresh when it regains focus.
  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  return { balance, failed };
}

export function PointsTotal() {
  const { balance, failed } = usePointsBalance();

  if (balance === null && !failed) return <Skeleton className="h-10 w-20 rounded-full" aria-label="Loading points" />;

  const total = balance === null ? "–" : balance.toLocaleString("en-GB");

  return (
    <div
      aria-label={balance === null ? "Points total unavailable" : `${total} points earned in total`}
      title="Total points your agents have earned"
      className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm sm:px-3.5"
    >
      <TrophyIcon className="size-4 text-primary-deep" aria-hidden="true" />
      <span className="font-bold text-foreground tabular-nums">{total}</span>
      <span className="hidden text-muted-foreground sm:inline">pts</span>
    </div>
  );
}
