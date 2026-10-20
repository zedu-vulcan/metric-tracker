"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, PlusIcon, TargetIcon } from "lucide-react";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { PillSelect, SearchPill, Toolbar, ToolbarGroup } from "@/components/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { GOAL_TYPES, summarizeGoal, type Goal, type GoalSummary } from "./goal-model";
import { GoalFormDialog } from "./GoalFormDialog";
import { OwnerAvatar, TaskProgress } from "./GoalParts";
import { useGoals } from "./GoalsProvider";

export function GoalsView() {
  const { goals, ideas, tasks, currentUser, createGoal } = useGoals();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();

  // Goals waiting on your review come first, then the rest of yours, then everyone else's.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return goals
      .filter(
        (goal) =>
          (typeFilter === "all" || goal.type === typeFilter) &&
          (!query || goal.title.toLowerCase().includes(query) || goal.description.toLowerCase().includes(query))
      )
      .map((goal) => {
        const summary = summarizeGoal(goal.id, ideas, tasks);
        const ownedByYou = goal.ownerId === currentUser.id;
        const rank = ownedByYou && summary.pendingIdeas > 0 ? 0 : ownedByYou ? 1 : 2;
        return { goal, summary, ownedByYou, rank };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [goals, ideas, tasks, currentUser.id, search, typeFilter]);

  const filtering = search !== "" || typeFilter !== "all";

  return (
    <>
      <PageHeader title="Goals" description="What the team is working towards. Agents propose the ideas and tasks to get there." />

      <PageContent>
        <Toolbar>
          <ToolbarGroup>
            <SearchPill value={search} onChange={setSearch} placeholder="Search goals" />
            <PillSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: "all", label: "All" }, ...GOAL_TYPES.map((type) => ({ value: type, label: type }))]}
            />
          </ToolbarGroup>
          <div className="flex items-center justify-between gap-4">
            <p className="m-0 text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {filtering ? `${filtered.length} of ${plural(goals.length, "goal")}` : plural(goals.length, "goal")}
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              New goal
            </Button>
          </div>
        </Toolbar>

        {filtered.length === 0 ? (
          <section className="rounded-[22px] border border-border bg-card p-5">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep">
                  <TargetIcon className="size-5" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{filtering ? "No goals match" : "No goals yet"}</EmptyTitle>
                <EmptyDescription>
                  {filtering ? "Try a different search or type." : "Create a goal so agents know what to work towards."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {filtering ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setFormOpen(true)}>
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    New goal
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          </section>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-4 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map(({ goal, summary, ownedByYou }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                summary={summary}
                ownedByYou={ownedByYou}
                ownerImage={ownedByYou ? currentUser.image : undefined}
              />
            ))}
          </ul>
        )}
      </PageContent>

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreate={(input) => router.push(`/dashboard/goals/${createGoal(input).id}`)}
      />
    </>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function GoalCard({
  goal,
  summary,
  ownedByYou,
  ownerImage,
}: {
  goal: Goal;
  summary: GoalSummary;
  ownedByYou: boolean;
  ownerImage?: string;
}) {
  const needsYou = ownedByYou && summary.pendingIdeas > 0;

  return (
    <li className="flex">
      <Link
        href={`/dashboard/goals/${goal.id}`}
        className="group/goal flex w-full flex-col gap-5 rounded-[22px] border border-border bg-card p-5 text-inherit no-underline transition-colors duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="m-0 line-clamp-2 text-lg leading-snug font-bold tracking-[-0.02em] text-balance text-foreground transition-colors group-hover/goal:text-primary-deep">
              {goal.title}
            </h3>
            <ArrowRightIcon
              className="mt-1 size-4 shrink-0 text-muted-foreground transition-[color,translate] duration-150 group-hover/goal:translate-x-0.5 group-hover/goal:text-primary-deep"
              aria-hidden="true"
            />
          </div>
          {goal.description && (
            <p className="m-0 line-clamp-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{goal.description}</p>
          )}
        </div>

        <TaskProgress label={goal.title} done={summary.approvedTasks} total={summary.totalTasks} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4">
          <p className="m-0 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
            <OwnerAvatar name={goal.ownerName} image={ownerImage} />
            <span className="truncate">
              <span className="font-semibold text-foreground">{ownedByYou ? "You" : goal.ownerName}</span> · {goal.type} ·{" "}
              {plural(summary.workstreams, "workstream")}
            </span>
          </p>
          {needsYou ? (
            <Badge variant="warning">{plural(summary.pendingIdeas, "idea")} to review</Badge>
          ) : summary.pendingIdeas > 0 ? (
            <span className="text-[13px] text-muted-foreground">{plural(summary.pendingIdeas, "idea")} proposed</span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
