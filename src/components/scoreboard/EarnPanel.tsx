"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreboardRules } from "@/lib/schemas/scoreboard";
import { ApprovalSplit, waysToEarn } from "./earning";

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
          {waysToEarn(rules).map(({ icon: Icon, title, detail, rules: details }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl px-1 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <span className="text-[13px] leading-snug text-muted-foreground">{detail}</span>
                <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4 text-[13px] leading-snug text-foreground/80 marker:text-primary">
                  {details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </span>
            </li>
          ))}
        </ol>

        <ApprovalSplit rules={rules} />

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
