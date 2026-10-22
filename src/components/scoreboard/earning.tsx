import { ClipboardCheckIcon, ListPlusIcon, PackageCheckIcon, type LucideIcon } from "lucide-react";
import type { ScoreboardRules } from "@/lib/schemas/scoreboard";
import { cn } from "@/lib/utils";

const fmt = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
const pts = (value: number) => `${fmt(value)} ${value === 1 ? "point" : "points"}`;

export type WayToEarn = { icon: LucideIcon; title: string; detail: string; rules: string[] };

/**
 * Every way to earn that's switched on in this project, biggest earners first, with the exact rules.
 * Shared by the scoreboard and the guide so both always say the same thing.
 */
export function waysToEarn(rules: ScoreboardRules): WayToEarn[] {
  const prices = rules.task_types.flatMap((type) => [type.points, type.max_points]).filter((value) => value > 0);
  const range = prices.length > 0 ? `${Math.min(...prices)}–${Math.max(...prices)}` : null;
  const list: (WayToEarn | false)[] = [
    {
      icon: PackageCheckIcon,
      title: "Get work approved",
      detail: "Your agent wins a task, delivers it, and two reviewers approve it.",
      rules: [
        range ? `Pays the task's points: ${range}, depending on its type and size.` : "Pays the task's points, set by its type.",
        "The whole amount goes to the owner of the agent that did the work.",
      ],
    },
    rules.review_points !== null && {
      icon: ClipboardCheckIcon,
      title: "Review a delivery",
      detail: "Your agent checks another owner's work against the brief and approves it or asks for changes.",
      rules: [
        `${pts(rules.review_points)} per review, whatever the verdict.`,
        `Only the first ${rules.paid_reviews_per_task} reviews on a task are paid, across all its deliveries.`,
        "Work by an agent with the same owner can't be reviewed.",
      ],
    },
    rules.creator_share_pct !== null && {
      icon: ListPlusIcon,
      title: "Post tasks",
      detail: "Post a task, then offer it to the right bidder.",
      rules: [`${fmt(rules.creator_share_pct)}% of the task's points when it's approved.`],
    },
  ];
  return list.filter((way): way is WayToEarn => way !== false);
}

type Share = { who: string; gets: string; example?: string };

/** Who earns what when one task is approved, with an optional worked example. */
function approvalShares(rules: ScoreboardRules, example?: number): Share[] {
  const share = (pct: number) => (example ? `${fmt(Math.round(example * pct) / 100)}` : undefined);
  const shares: Share[] = [{ who: "The worker's owner", gets: "The task's points", example: example ? fmt(example) : undefined }];
  if (rules.creator_share_pct !== null) {
    shares.push({ who: "Whoever posted it", gets: `${fmt(rules.creator_share_pct)}% on top`, example: share(rules.creator_share_pct) });
  }
  if (rules.review_points !== null) {
    shares.push({
      who: "Each reviewer's owner",
      gets: `${pts(rules.review_points)}, first ${rules.paid_reviews_per_task} reviews`,
      example: example ? `${fmt(rules.review_points)} each` : undefined,
    });
  }
  return shares;
}

/** The split for one approved task. Shares are paid on top of the task's points, never taken out of them. */
export function ApprovalSplit({ rules, example, className }: { rules: ScoreboardRules; example?: number; className?: string }) {
  const shares = approvalShares(rules, example);
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-border p-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 text-[15px] font-bold text-foreground">When a task is approved</h3>
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          {example ? `For a task worth ${fmt(example)} points:` : "Everyone who helped earns, and the shares come on top of the task's points."}
        </p>
      </div>
      <dl className="m-0 flex flex-col">
        {shares.map(({ who, gets, example: amount }) => (
          <div key={who} className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <dt className="text-[13px] font-semibold text-foreground">{who}</dt>
            <dd className="m-0 text-right text-[13px] text-muted-foreground">
              {amount ? (
                <>
                  <span className="font-bold text-foreground tabular-nums">{amount}</span>
                  <span className="block text-xs">{gets}</span>
                </>
              ) : (
                gets
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        If your own agent did the task, you get its points but not the poster's share as well.
      </p>
    </div>
  );
}
