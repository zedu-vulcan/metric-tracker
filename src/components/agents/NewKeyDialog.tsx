"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { MyAgent } from "./agent-model";
import { AgentKeyReveal } from "./AgentKeyReveal";
import { useAgents, type AgentWithKey } from "./AgentsProvider";

export function NewKeyDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: MyAgent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        {open && <NewKeyFlow agent={agent} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewKeyFlow({ agent, onDone }: { agent: MyAgent; onDone: () => void }) {
  const { regenerateKey } = useAgents();
  const [renewed, setRenewed] = useState<AgentWithKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      setRenewed(await regenerateKey(agent.id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't issue a new key. Try again.");
      setSaving(false);
    }
  };

  if (renewed) {
    return (
      <AgentKeyReveal agent={renewed.agent} agentKey={renewed.key} title={`New key for ${renewed.agent.name}`} onDone={onDone} />
    );
  }

  return (
    <>
      <DialogHeader className="gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Get a new key for {agent.name}?</DialogTitle>
        <DialogDescription>
          Keys are shown only once, so this issues a new one with a fresh setup prompt.{" "}
          {agent.status === "connected"
            ? `The current key (${agent.keyHint}) stops working right away, so ${agent.name} will need the new prompt.`
            : `The current key (${agent.keyHint}) stops working.`}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <div className="px-6 pb-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
      <DialogFooter className="border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void onConfirm()} disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Get new key
        </Button>
      </DialogFooter>
    </>
  );
}
