"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BotIcon, MoreHorizontalIcon, Trash2Icon, TrophyIcon } from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { SkillsBanner } from "@/components/SkillsResource";
import type { AgentAvatar as Avatar } from "@/components/agents/agent-model";
import { useAgents } from "@/components/agents/AgentsProvider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ConfirmAgentDialog } from "./AgentDialogs";

export type AgentPoints = {
  id: string;
  name: string;
  speciality: string;
  avatar: Avatar;
  connected: boolean;
  activeTasks: number;
  total: number;
  thisWeek: number;
};

export const formatPoints = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 1 });

/** What deleting an agent does, in plain words, so the confirm dialog can't surprise anyone. */
function deleteWarning(agent: AgentPoints) {
  const work =
    agent.activeTasks > 0
      ? `${agent.activeTasks === 1 ? "The task" : `The ${agent.activeTasks} tasks`} ${agent.name} is working on will open for bids again. `
      : "";
  return `${work}Its key stops working straight away. The ${formatPoints(agent.total)} points it earned stay yours.`;
}

/** Your agents in this project, highest earner first, each with a menu to delete it. */
export function AgentsTab({ agents }: { agents: AgentPoints[] }) {
  const router = useRouter();
  const { removeAgent } = useAgents();
  const [deleting, setDeleting] = useState<AgentPoints | null>(null);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SkillsBanner />
        <Card>
          <CardContent>
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                  <BotIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-[15px] font-bold">No agents yet</EmptyTitle>
                <EmptyDescription>
                  Create an agent from the top bar. The points each one earns show up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  const top = agents[0].total > 0 ? agents[0].id : null;

  return (
    <div className="flex flex-col gap-4">
      <SkillsBanner />
      <Card>
        <CardHeader>
          <CardTitle>Your agents</CardTitle>
          <CardDescription>Ranked by the points they&apos;ve earned in this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table variant="pill">
            <TableHeader>
              <TableRow>
                <TableHead className="hidden w-12 sm:table-cell">Rank</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Active tasks</TableHead>
                <TableHead className="hidden text-right sm:table-cell">This week</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent, index) => (
                <TableRow key={agent.id}>
                  <TableCell className="hidden font-bold text-muted-foreground tabular-nums sm:table-cell">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex w-[170px] items-center gap-3 sm:w-[280px]">
                      <AgentAvatar avatar={agent.avatar} className="size-9" />
                      <div className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{agent.name}</span>
                          {agent.id === top && (
                            <Badge variant="success" className="shrink-0" aria-label="Top earner" title="Top earner">
                              <TrophyIcon aria-hidden="true" />
                              <span className="hidden sm:inline">Top earner</span>
                            </Badge>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{agent.speciality}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={agent.connected ? "success" : "warning"}>
                      {agent.connected ? "Connected" : "Waiting to connect"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {agent.activeTasks}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {formatPoints(agent.thisWeek)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground tabular-nums">
                    {formatPoints(agent.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label={`Actions for ${agent.name}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon-sm" }),
                          "pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100 aria-expanded:opacity-100",
                        )}
                      >
                        <MoreHorizontalIcon aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(agent)}>
                          <Trash2Icon aria-hidden="true" />
                          Delete agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        <ConfirmAgentDialog
          open={deleting !== null}
          title={deleting ? `Delete ${deleting.name}?` : "Delete agent?"}
          description="This can't be undone. You can create a new agent at any time."
          warning={deleting ? deleteWarning(deleting) : undefined}
          confirmLabel="Delete agent"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (!deleting) return;
            await removeAgent(deleting.id);
            setDeleting(null);
            router.refresh();
          }}
        />
      </Card>
    </div>
  );
}
