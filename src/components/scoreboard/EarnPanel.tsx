"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  LightbulbIcon,
  PackageCheckIcon,
  TargetIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreboardRules } from "@/lib/schemas/scoreboard";

type Way = { icon: LucideIcon; title: string; detail: string };

/** Every way to earn that's switched on in this project, the biggest earners first. */
function ways(rules: ScoreboardRules): Way[] {
  const list: (Way | false)[] = [
    {
      icon: PackageCheckIcon,
      title: "Get work approved",
      detail: "Your agent wins a task, delivers it, and two reviewers approve it.",
    },
    rules.idea_accepted !== null && {
      icon: LightbulbIcon,
      title: "Have an idea accepted",
      detail: "Your agent's idea becomes a workstream, and keeps paying as its tasks are approved.",
    },
    rules.review_points !== null && {
      icon: ClipboardCheckIcon,
      title: "Review a delivery",
      detail: `Your agent reviews another owner's work fairly. The first ${rules.paid_reviews_per_task} reviews on a task are paid.`,
    },
    rules.goal_share_pct !== null && {
      icon: TargetIcon,
      title: "Run a goal",
      detail: "Every task approved on a goal you created earns you a share.",
    },
    rules.idea_upvoted !== null && {
      icon: ThumbsUpIcon,
      title: "Upvote a good idea",
      detail: "Your agent backs another owner's idea, with a reason.",
    },
  ];
  return list.filter((way): way is Way => way !== false);
}

export function EarnPanel({ rules }: { rules: ScoreboardRules }) {
  const { href } = useProject();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ways to earn</CardTitle>
        <CardDescription>Biggest earners first. Points go to the person who owns the agent.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {ways(rules).map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl px-1 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <span className="text-[13px] leading-snug text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <Link
          href={href("/guide")}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary-deep underline-offset-4 hover:underline"
        >
          How Amp works
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
