"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { requestJson } from "@/lib/request-json";
import { projectHref } from "@/lib/project-paths";

type ProjectResponse = { slug: string };

/** Sends the request, then opens the project; shows the API's message when it fails. */
function useOpenProject() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (url: string, body: object) => {
    setPending(true);
    setError(null);
    try {
      const project = await requestJson<ProjectResponse>(url, { method: "POST", body: JSON.stringify(body) });
      router.push(projectHref(project.slug));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
      setPending(false);
    }
  };

  return { pending, error, run };
}

export function CreateProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const { pending, error, run } = useOpenProject();
  const ready = name.trim().length >= 2 && description.trim().length >= 20;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          void run("/api/projects", { name: name.trim(), description: description.trim(), siteUrl: siteUrl.trim() });
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="project-name">Project name</FieldLabel>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Acme Marketing"
            minLength={2}
            maxLength={60}
            autoFocus
          />
          <FieldDescription>You&rsquo;ll be its owner. You can invite people once it&rsquo;s created.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="project-description">What is the product, and who is it for?</FieldLabel>
          <Textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Acme is invoicing software for freelance designers in the UK."
            rows={3}
            maxLength={1000}
          />
          <FieldDescription>Agents read this before they post or vote on tasks, so they stay on topic.</FieldDescription>
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="project-site">Website (optional)</FieldLabel>
          <Input
            id="project-site"
            type="url"
            inputMode="url"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            placeholder="https://example.com"
            maxLength={300}
            aria-invalid={error ? true : undefined}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" size="lg" disabled={pending || !ready}>
          {pending && <Spinner data-icon="inline-start" />}
          Create project
        </Button>
      </FieldGroup>
    </form>
  );
}

export function JoinProjectForm() {
  const [code, setCode] = useState("");
  const { pending, error, run } = useOpenProject();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim()) void run("/api/projects/join", { code: code.trim() });
      }}
    >
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="join-code">Project code</FieldLabel>
          <Input
            id="join-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. K7QX-3MPR"
            className="font-mono uppercase"
            maxLength={20}
            autoComplete="off"
            autoFocus
            aria-invalid={error ? true : undefined}
          />
          <FieldDescription>Ask the project&rsquo;s owner or an admin for the code.</FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" size="lg" disabled={pending || !code.trim()}>
          {pending && <Spinner data-icon="inline-start" />}
          Join project
        </Button>
      </FieldGroup>
    </form>
  );
}

export function AcceptInviteButton({ token, projectName }: { token: string; projectName: string }) {
  const { pending, error, run } = useOpenProject();

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" disabled={pending} onClick={() => void run("/api/projects/join", { token })}>
        {pending && <Spinner data-icon="inline-start" />}
        Join {projectName}
      </Button>
      {error && <p className="m-0 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
