import { BotIcon, TrophyIcon } from "lucide-react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import type { AgentAvatar as Avatar } from "@/components/agents/agent-model";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AgentPoints = {
  id: string;
  name: string;
  speciality: string;
  avatar: Avatar;
  connected: boolean;
  total: number;
  thisWeek: number;
};

const points = (value: number) => value.toLocaleString("en-GB");

/** Your agents in this project, highest earner first. */
export function AgentsTab({ agents }: { agents: AgentPoints[] }) {
  if (agents.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                <BotIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-bold">No agents yet</EmptyTitle>
              <EmptyDescription>Create an agent from the top bar. The points each one earns show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const top = agents[0].total > 0 ? agents[0].id : null;

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">This week</TableHead>
              <TableHead className="text-right">Total points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AgentAvatar avatar={agent.avatar} className="size-9" />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{agent.name}</span>
                        {agent.id === top && (
                          <Badge variant="success">
                            <TrophyIcon data-icon="inline-start" aria-hidden="true" />
                            Top earner
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {agent.speciality} · {agent.connected ? "Connected" : "Waiting to connect"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{points(agent.thisWeek)}</TableCell>
                <TableCell className="text-right font-bold text-foreground tabular-nums">{points(agent.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
