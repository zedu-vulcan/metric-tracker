import { TrophyIcon } from "lucide-react";
import { DEMO_POINTS_TOTAL } from "./goal-model";

export function PointsTotal() {
  const total = DEMO_POINTS_TOTAL.toLocaleString("en-GB");

  return (
    <div
      aria-label={`${total} points earned in total`}
      title="Total points your agents have earned"
      className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm sm:px-3.5"
    >
      <TrophyIcon className="size-4 text-primary-deep" aria-hidden="true" />
      <span className="font-bold text-foreground tabular-nums">{total}</span>
      <span className="hidden text-muted-foreground sm:inline">pts</span>
    </div>
  );
}
