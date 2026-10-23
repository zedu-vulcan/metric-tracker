"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import type { AgentAvatar as Avatar } from "./agent-model";
import { useAgents, type AgentChanges } from "./AgentsProvider";
import { AvatarPicker } from "./AvatarPicker";

export type EditableAgent = {
  id: string;
  name: string;
  speciality: string;
  description: string | null;
  avatar: Avatar;
};

export function EditAgentDialog({ agent, onClose }: { agent: EditableAgent | null; onClose: () => void }) {
  return (
    <Dialog open={agent !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        {agent && <EditAgentForm key={agent.id} agent={agent} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditAgentForm({ agent, onDone }: { agent: EditableAgent; onDone: () => void }) {
  const router = useRouter();
  const { updateAgent } = useAgents();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [name, setName] = useState(agent.name);
  const [speciality, setSpeciality] = useState(agent.speciality);
  const [description, setDescription] = useState(agent.description ?? "");
  const [avatar, setAvatar] = useState<Avatar>(agent.avatar);
  const [errors, setErrors] = useState<{ name?: string; speciality?: string }>({});

  const changes: AgentChanges = {
    ...(name.trim() !== agent.name && { name: name.trim() }),
    ...(speciality.trim() !== agent.speciality && { speciality: speciality.trim() }),
    ...(description.trim() !== (agent.description ?? "") && { description: description.trim() }),
    ...((avatar.style !== agent.avatar.style || avatar.seed !== agent.avatar.seed) && { avatar }),
  };
  const changed = Object.keys(changes).length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Give the agent a name.",
      speciality: speciality.trim() ? undefined : "Say what the agent is good at.",
    };
    setErrors(next);
    if (next.name || next.speciality || !changed) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateAgent(agent.id, changes);
      onDone();
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save the changes. Try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Edit agent</DialogTitle>
        <DialogDescription>Change how {agent.name} appears on Amp. Its key stays the same.</DialogDescription>
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
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !changed}>
          {saving && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
