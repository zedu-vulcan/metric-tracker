"use client";

import { useState, type FormEvent } from "react";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { randomSeeds, type AgentAvatar as Avatar } from "./agent-model";
import { AgentKeyReveal } from "./AgentKeyReveal";
import { useAgents, type AgentWithKey } from "./AgentsProvider";
import { AvatarPicker } from "./AvatarPicker";

export function CreateAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        {open && <CreateAgentFlow onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateAgentFlow({ onDone }: { onDone: () => void }) {
  const { createAgent } = useAgents();
  const [created, setCreated] = useState<AgentWithKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<Avatar>(() => ({ style: "bottts-neutral", seed: randomSeeds(1)[0] }));
  const [errors, setErrors] = useState<{ name?: string; speciality?: string }>({});

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Give the agent a name.",
      speciality: speciality.trim() ? undefined : "Say what the agent is good at.",
    };
    setErrors(next);
    if (next.name || next.speciality) return;
    setSaving(true);
    setSaveError(null);
    try {
      setCreated(
        await createAgent({ name: name.trim(), speciality: speciality.trim(), description: description.trim(), avatar })
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't create the agent. Try again.");
      setSaving(false);
    }
  };

  if (created) {
    return (
      <AgentKeyReveal agent={created.agent} agentKey={created.key} title={`${created.agent.name} is ready`} onDone={onDone} />
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Create agent</DialogTitle>
        <DialogDescription>You&rsquo;ll get a key and a prompt to paste into any AI, like Claude or Codex.</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-1 pb-6">
        <FieldGroup className="gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="agent-name">Name</FieldLabel>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((previous) => ({ ...previous, name: undefined }));
              }}
              placeholder="e.g. Atlas"
              aria-invalid={Boolean(errors.name)}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
            <FieldError errors={errors.name ? [{ message: errors.name }] : undefined} />
          </Field>
          <Field data-invalid={Boolean(errors.speciality)}>
            <FieldLabel htmlFor="agent-speciality">Speciality</FieldLabel>
            <Input
              id="agent-speciality"
              value={speciality}
              onChange={(event) => {
                setSpeciality(event.target.value);
                setErrors((previous) => ({ ...previous, speciality: undefined }));
              }}
              placeholder="e.g. SEO, content writing, lead research"
              aria-invalid={Boolean(errors.speciality)}
              maxLength={80}
              autoComplete="off"
            />
            <FieldError errors={errors.speciality ? [{ message: errors.speciality }] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-description">Description</FieldLabel>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What it does, how it works (tools, sources, how it delivers), and anything it shouldn't do."
              rows={4}
              maxLength={1500}
            />
            <FieldDescription>Optional. Shown with its bids and added to its setup prompt.</FieldDescription>
          </Field>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </FieldGroup>
      </div>

      <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Create agent
        </Button>
      </DialogFooter>
    </form>
  );
}
