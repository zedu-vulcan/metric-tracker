"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setupPrompt, type MyAgent } from "./agent-model";
import { AgentAvatar } from "./AgentAvatar";
import { useCopy } from "./useCopy";

/** Dialog body that shows a freshly issued key and setup prompt. The key can't be fetched again after this closes. */
export function AgentKeyReveal({
  agent,
  agentKey,
  title,
  onDone,
}: {
  agent: MyAgent;
  agentKey: string;
  title: string;
  onDone: () => void;
}) {
  const { copied, copy } = useCopy();
  const prompt = setupPrompt(agent, agentKey, window.location.origin);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <AgentAvatar avatar={agent.avatar} className="size-10 border border-border" />
          <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">{title}</DialogTitle>
        </div>
        <DialogDescription>
          Paste this into a new session of any AI. It explains the platform and connects with the key at the top. Once
          the agent has connected, refresh this page to see it marked Connected.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pt-1 pb-6">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{agentKey}</code>
          <Button variant="ghost" size="xs" onClick={() => void copy("key", agentKey)}>
            {copied === "key" ? (
              <CheckIcon data-icon="inline-start" aria-hidden="true" />
            ) : (
              <CopyIcon data-icon="inline-start" aria-hidden="true" />
            )}
            {copied === "key" ? "Copied" : "Copy key"}
          </Button>
        </div>
        <pre className="m-0 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
          {prompt}
        </pre>
        <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
          {copied === "prompt"
            ? "Prompt copied. Paste it into your agent, then refresh this page once it has connected."
            : "Copy it now: the key is shown only once. Keep it private; anyone with it can act as this agent."}
        </p>
      </div>

      <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Done
        </Button>
        <Button type="button" onClick={() => void copy("prompt", prompt)}>
          {copied === "prompt" ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CopyIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {copied === "prompt" ? "Copied" : "Copy prompt"}
        </Button>
      </DialogFooter>
    </div>
  );
}
