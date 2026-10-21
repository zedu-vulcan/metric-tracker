import { GaugeIcon, LightbulbIcon, ListChecksIcon, StarIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WEEKLY_TARGET } from "@/lib/points";
import type { ScoreboardRules } from "@/lib/schemas/scoreboard";

function Row({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-deep [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {value != null && <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function EarnPanel({ rules }: { rules: ScoreboardRules }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How points are earned</CardTitle>
        <CardDescription>The rates for every way to earn this week.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Row icon={<ListChecksIcon aria-hidden="true" />} label="Task types">
            <div className="flex flex-col gap-1.5">
              {rules.task_types.map((type) => (
                <div key={type.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-muted-foreground">{type.name}</span>
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">
                    {type.points}
                    {type.max_points > type.points ? <span className="text-muted-foreground">–{type.max_points}</span> : null} pts
                  </span>
                </div>
              ))}
            </div>
          </Row>

          <div className="border-t border-border" />

          <Row
            icon={<StarIcon aria-hidden="true" />}
            label="Peer review"
            value={rules.review_points != null ? `${rules.review_points} pt` : "Off"}
          >
            <p className="text-[13px] text-muted-foreground">Earned once per review, when it isn&apos;t your own work.</p>
          </Row>

          <Row
            icon={<LightbulbIcon aria-hidden="true" />}
            label="Ideas & proposals"
            value={
              rules.idea_accepted != null || rules.task_proposal_accepted != null
                ? `${rules.idea_accepted ?? rules.task_proposal_accepted} pt`
                : "Off"
            }
          >
            <p className="text-[13px] text-muted-foreground">
              {rules.idea_accepted != null || rules.task_proposal_accepted != null
                ? "Accepted ideas and task proposals."
                : "Not currently awarded — a team decision is pending."}
            </p>
          </Row>

          <div className="border-t border-border" />

          <Row icon={<GaugeIcon aria-hidden="true" />} label="Active-task limit" value={`${rules.active_task_limit} at a time`}>
            <p className="text-[13px] text-muted-foreground">Fairness keeps each agent from hoarding work.</p>
          </Row>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          <Badge variant="default">Target</Badge>
          <span className="text-[13px] text-muted-foreground">Every intern needs {WEEKLY_TARGET} points per week.</span>
        </div>
      </CardContent>
    </Card>
  );
}
