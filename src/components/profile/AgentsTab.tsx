"use client";

import { useCallback, useEffect, useState } from "react";
import { BotIcon, CircleCheckIcon, KeyRoundIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addNotification,
  deleteAgent,
  generateAgentKey,
  listAgents,
  updateAgent,
  type Agent,
  type AgentInput,
  type NotificationInput,
} from "@/lib/profile/profile-service";
import { ConfirmAgentDialog, EditAgentDialog, NewKeyDialog } from "./AgentDialogs";
import { refreshNotifications } from "./useNotifications";

type OpenDialog = { type: "edit" | "delete" | "rekey"; agent: Agent } | null;

export function AgentsTab() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [reveal, setReveal] = useState<{ agentName: string; key: string } | null>(null);
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => setAgents(await listAgents()), []);

  useEffect(() => {
    void load();
  }, [load]);

  // Every agent action is logged as a notification, so the bell and Inbox update with the list.
  const afterAction = async (note: NotificationInput) => {
    await addNotification(note);
    await Promise.all([load(), refreshNotifications()]);
    setDialog(null);
  };

  const onSave = async (agent: Agent, input: AgentInput) => {
    const updated = await updateAgent(agent.id, input);
    await afterAction({
      kind: "agent_edited",
      title: "Agent updated",
      message:
        agent.name === updated.name
          ? `${updated.name} now specialises in ${updated.speciality}.`
          : `${agent.name} was renamed to ${updated.name} and specialises in ${updated.speciality}.`,
    });
    setSaved(`Saved. ${updated.name} now specialises in ${updated.speciality}.`);
  };

  const onDelete = async (agent: Agent) => {
    await deleteAgent(agent.id);
    await afterAction({
      kind: "agent_deleted",
      title: "Agent deleted",
      message: `${agent.name} was removed and its key no longer works.`,
    });
    setSaved(`${agent.name} was deleted.`);
  };

  const onRekey = async (agent: Agent) => {
    const result = await generateAgentKey(agent.id);
    await afterAction({
      kind: "agent_rekeyed",
      title: "New agent key created",
      message: `${agent.name} has a new key. The old key stopped working, so update it in your agent.`,
    });
    setSaved("");
    setReveal({ agentName: result.agent.name, key: result.key });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your agents</CardTitle>
        <CardDescription>Edit an agent, create a fresh key for it, or remove it. Keys are always hidden here.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {saved && (
          <Alert className="border-success/30 bg-success-muted text-success" role="status">
            <CircleCheckIcon aria-hidden="true" />
            <AlertDescription className="text-success">{saved}</AlertDescription>
          </Alert>
        )}

        {agents === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-[84px] w-full rounded-2xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
                <BotIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-bold">No agents yet</EmptyTitle>
              <EmptyDescription>
                Agents you connect to Zedu Amp will show up here, along with the points they earn for you.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep">
                    <BotIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-bold text-foreground">{agent.name}</p>
                    <p className="m-0 truncate text-xs text-muted-foreground">{agent.speciality}</p>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                      <span className="sr-only">Key </span>
                      <span className="font-mono">{agent.keyHint}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDialog({ type: "edit", agent })}>
                    <PencilIcon data-icon="inline-start" aria-hidden="true" />
                    Edit<span className="sr-only"> {agent.name}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDialog({ type: "rekey", agent })}>
                    <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                    New key<span className="sr-only"> for {agent.name}</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDialog({ type: "delete", agent })}>
                    <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                    Delete<span className="sr-only"> {agent.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <EditAgentDialog agent={dialog?.type === "edit" ? dialog.agent : null} onClose={() => setDialog(null)} onSave={onSave} />

      <ConfirmAgentDialog
        open={dialog?.type === "delete"}
        title={`Delete ${dialog?.agent.name ?? "agent"}?`}
        description="This can't be undone. The agent is removed from your list and its key stops working."
        confirmLabel="Delete agent"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => (dialog ? onDelete(dialog.agent) : Promise.resolve())}
      />

      <ConfirmAgentDialog
        open={dialog?.type === "rekey"}
        title={`Create a new key for ${dialog?.agent.name ?? "agent"}?`}
        description="We'll create a new key and show it to you once."
        warning="The old key stops working immediately. Your agent can't connect until you update it with the new key."
        confirmLabel="Create new key"
        onClose={() => setDialog(null)}
        onConfirm={() => (dialog ? onRekey(dialog.agent) : Promise.resolve())}
      />

      <NewKeyDialog reveal={reveal} onClose={() => setReveal(null)} />
    </Card>
  );
}
