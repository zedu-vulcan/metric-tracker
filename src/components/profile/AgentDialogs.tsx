"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangleIcon, CheckIcon, CopyIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  validateAgentInput,
  type Agent,
  type AgentInput,
  type AgentInputErrors,
} from "@/lib/profile/profile-service";

const TITLE = "text-xl font-extrabold tracking-[-0.03em]";

export function EditAgentDialog({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSave: (agent: Agent, input: AgentInput) => Promise<void>;
}) {
  return (
    <Dialog open={agent !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        {agent && <EditAgentForm key={agent.id} agent={agent} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function EditAgentForm({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (agent: Agent, input: AgentInput) => Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [speciality, setSpeciality] = useState(agent.speciality);
  const [errors, setErrors] = useState<AgentInputErrors>({});
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateAgentInput({ name, speciality });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure("");
    try {
      await onSave(agent, { name, speciality });
    } catch {
      setFailure("We couldn't save your changes. Please try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className={TITLE}>Edit agent</DialogTitle>
        <DialogDescription>Change how {agent.name} appears on the platform. Its key stays the same.</DialogDescription>
      </DialogHeader>

      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="agent-name">Name</FieldLabel>
          <Input
            id="agent-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((previous) => ({ ...previous, name: undefined }));
            }}
            aria-invalid={Boolean(errors.name)}
            maxLength={40}
            autoComplete="off"
            autoFocus
          />
          <FieldError errors={errors.name ? [{ message: errors.name }] : undefined} />
        </Field>
        <Field data-invalid={Boolean(errors.speciality)}>
          <FieldLabel htmlFor="agent-speciality">Specialisation</FieldLabel>
          <Input
            id="agent-speciality"
            value={speciality}
            onChange={(event) => {
              setSpeciality(event.target.value);
              setErrors((previous) => ({ ...previous, speciality: undefined }));
            }}
            placeholder="e.g. Technical SEO"
            aria-invalid={Boolean(errors.speciality)}
            maxLength={80}
            autoComplete="off"
          />
          <FieldError errors={errors.speciality ? [{ message: errors.speciality }] : undefined} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConfirmAgentDialog({
  open,
  title,
  description,
  warning,
  confirmLabel,
  destructive,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  warning?: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const confirm = async () => {
    setBusy(true);
    setFailure("");
    try {
      await onConfirm();
    } catch {
      setFailure("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) {
          setFailure("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className={TITLE}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {warning && (
          <Alert className="border-warning/30 bg-warning-muted text-warning">
            <AlertTriangleIcon aria-hidden="true" />
            <AlertDescription className="text-warning">{warning}</AlertDescription>
          </Alert>
        )}
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={() => void confirm()} disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewKeyDialog({
  reveal,
  onClose,
}: {
  reveal: { agentName: string; key: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.key);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  const close = () => {
    setCopied(false);
    setCopyFailed(false);
    onClose();
  };

  return (
    <Dialog open={reveal !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className={TITLE}>New key for {reveal?.agentName}</DialogTitle>
          <DialogDescription>
            Copy it now. For your security we show this key only once and can&apos;t show it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 p-2 pl-4">
          <code className="min-w-0 flex-1 font-mono text-xs break-all text-foreground">{reveal?.key}</code>
          <Button type="button" variant={copied ? "secondary" : "outline"} size="sm" onClick={() => void copy()}>
            {copied ? <CheckIcon data-icon="inline-start" aria-hidden="true" /> : <CopyIcon data-icon="inline-start" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="sr-only" role="status">
          {copied ? "Key copied to the clipboard" : ""}
        </p>
        {copyFailed && (
          <Alert variant="destructive">
            <AlertDescription>Your browser blocked copying. Select the key above and copy it by hand.</AlertDescription>
          </Alert>
        )}

        <Alert className="border-warning/30 bg-warning-muted text-warning">
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>Update it in your agent now</AlertTitle>
          <AlertDescription className="text-warning">
            The old key stopped working the moment this one was created. {reveal?.agentName} can&apos;t connect until you paste the new key into it.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" onClick={close}>
            I&apos;ve saved the key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
