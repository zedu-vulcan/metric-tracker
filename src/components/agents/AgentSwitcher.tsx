"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, CopyIcon, KeyRoundIcon, PlugIcon, PlusIcon, TrophyIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { NewTaskButton } from "@/components/tasks/NewTaskButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { setupPrompt } from "./agent-model";
import { AgentAvatar } from "./AgentAvatar";
import { useAgents } from "./AgentsProvider";
import { CreateAgentDialog } from "./CreateAgentDialog";
import { NewKeyDialog } from "./NewKeyDialog";
import { useCopy } from "./useCopy";

/**
 * The top bar's next step plus the agent pill. The one primary button follows the user's progress:
 * create an agent, then connect it, then post tasks. Everything else about agents lives in the pill's menu.
 */
export function AgentSwitcher() {
  const { agents, loading, selected, select } = useAgents();
  const [creating, setCreating] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const { copied, copy } = useCopy();
  const project = useProject();

  // The dialogs sit in one fixed place for every branch, so creating the first agent (which swaps the
  // placeholder for the pill) doesn't remount the open dialog and lose its "ready" step.
  const dialogs = (
    <>
      <CreateAgentDialog open={creating} onOpenChange={setCreating} />
      {selected && <NewKeyDialog agent={selected} open={renewing} onOpenChange={setRenewing} />}
    </>
  );

  if (loading) {
    return (
      <>
        {dialogs}
        <Skeleton className="h-10 w-32 rounded-full sm:w-44" />
      </>
    );
  }

  if (!selected) {
    return (
      <>
        <Button onClick={() => setCreating(true)} className="hidden sm:inline-flex">
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Create agent
        </Button>
        <Button size="icon" onClick={() => setCreating(true)} aria-label="Create agent" className="sm:hidden">
          <PlusIcon aria-hidden="true" />
        </Button>
        {dialogs}
      </>
    );
  }

  const promptCopied = copied === selected.id;
  const anyConnected = agents.some((agent) => agent.status === "connected");
  const copyPrompt = () => void copy(selected.id, setupPrompt(selected, undefined, window.location.origin, project.name));

  return (
    <>
      {anyConnected ? (
        <NewTaskButton />
      ) : (
        <Button
          onClick={copyPrompt}
          aria-label={`Copy the setup prompt for ${selected.name}`}
          title="Paste this prompt into your agent. Give it the key when it asks, or use New key in the agent menu."
        >
          {promptCopied ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <PlugIcon data-icon="inline-start" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{promptCopied ? "Prompt copied" : "Connect agent"}</span>
        </Button>
      )}
      {dialogs}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Agent: ${selected.name}, ${selected.status === "connected" ? "connected" : "waiting to connect"}. Open agent menu`}
          className="flex h-10 min-w-0 items-center gap-2 rounded-full border border-border bg-card pr-2.5 pl-1.5 text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="relative flex shrink-0">
            <AgentAvatar avatar={selected.avatar} className="size-7" />
            <StatusDot connected={selected.status === "connected"} />
          </span>
          <span className="hidden max-w-[160px] truncate sm:inline">{selected.name}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Your agents</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selected.id} onValueChange={select}>
            {agents.map((agent) => (
              <DropdownMenuRadioItem key={agent.id} value={agent.id} className="gap-2.5 py-1.5">
                <AgentAvatar avatar={agent.avatar} className="size-8" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{agent.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {agent.speciality} · {agent.status === "connected" ? "Connected" : "Waiting to connect"}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copyPrompt}>
            <CopyIcon aria-hidden="true" />
            Copy setup prompt
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenewing(true)} title={`Current key: ${selected.keyHint}`}>
            <KeyRoundIcon aria-hidden="true" />
            New key
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={project.href("/profile?tab=agents")}>
              <TrophyIcon aria-hidden="true" />
              Points by agent
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" />
            Create agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="sr-only" aria-live="polite">
        {promptCopied ? `Setup prompt for ${selected.name} copied, without the key` : ""}
      </span>
    </>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card",
        connected ? "bg-success" : "bg-warning"
      )}
    />
  );
}
