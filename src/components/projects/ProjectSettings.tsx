"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectRole } from "@prisma/client";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useCopy } from "@/components/agents/useCopy";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requestJson } from "@/lib/request-json";

type SettingsProject = {
  id: string;
  name: string;
  slug: string;
  role: ProjectRole;
  joinCode: string | null;
  inviteToken: string | null;
};

type Member = { userId: string; name: string | null; email: string | null; role: ProjectRole; joinedAt: string };

type Confirm = { title: string; description: string; action: string; run: () => Promise<void> };

const ROLE_LABEL: Record<ProjectRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const ROLE_BADGE: Record<ProjectRole, "default" | "info" | "secondary"> = {
  owner: "default",
  admin: "info",
  member: "secondary",
};

export function ProjectSettings({
  project,
  members,
  currentUserId,
}: {
  project: SettingsProject;
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { href, canManage } = useProject();
  const isOwner = project.role === "owner";
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(work: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await work();
      setConfirm(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  const changeRole = (member: Member, role: ProjectRole) =>
    act(async () => {
      await requestJson(`/api/projects/${project.id}/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    });

  const removeMember = (member: Member) => {
    const leaving = member.userId === currentUserId;
    setError(null);
    setConfirm({
      title: leaving ? "Leave this project?" : `Remove ${member.name ?? member.email ?? "this member"}?`,
      description: leaving
        ? "You'll lose access to its goals, tasks and scoreboard, and your agents here are deleted."
        : "They lose access straight away, and their agents in this project are deleted. Their points stay in the ledger.",
      action: leaving ? "Leave project" : "Remove",
      run: async () => {
        await requestJson(`/api/projects/${project.id}/members/${member.userId}`, { method: "DELETE" });
        if (leaving) router.push("/dashboard");
      },
    });
  };

  const canRemove = (member: Member) =>
    member.role !== "owner" &&
    (member.userId === currentUserId || isOwner || (canManage && member.role === "member"));

  return (
    <div className="grid gap-4">
      {error && !confirm && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {canManage && project.inviteToken && project.joinCode && (
        <InviteCard
          projectId={project.id}
          inviteToken={project.inviteToken}
          joinCode={project.joinCode}
          onReset={() =>
            setConfirm({
              title: "Reset the invite link and code?",
              description: "The current link and code stop working. People already in the project stay.",
              action: "Reset",
              run: async () => {
                await requestJson(`/api/projects/${project.id}/invite`, { method: "POST" });
              },
            })
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "person" : "people"}. Admins manage members, the invite link and task
            types; only the owner changes roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="grid min-w-0">
                      <span className="truncate font-medium text-foreground">
                        {member.name ?? member.email ?? "Unnamed"}
                        {member.userId === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                      {member.name && member.email && (
                        <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOwner && member.role !== "owner" ? (
                      <NativeSelect
                        size="sm"
                        aria-label={`Role for ${member.name ?? member.email ?? "member"}`}
                        value={member.role}
                        disabled={pending}
                        onChange={(event) => void changeRole(member, event.target.value as ProjectRole)}
                      >
                        <NativeSelectOption value="admin">Admin</NativeSelectOption>
                        <NativeSelectOption value="member">Member</NativeSelectOption>
                      </NativeSelect>
                    ) : (
                      <Badge variant={ROLE_BADGE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {member.joinedAt.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    {canRemove(member) && (
                      <Button variant="ghost" size="sm" onClick={() => removeMember(member)}>
                        {member.userId === currentUserId ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <ProjectCard
          project={project}
          taskTypesHref={href("/task-types")}
          onDelete={() =>
            setConfirm({
              title: `Delete ${project.name}?`,
              description:
                "This deletes its goals, tasks, agents, points and marketing records for everyone. It can't be undone.",
              action: "Delete project",
              run: async () => {
                await requestJson(`/api/projects/${project.id}`, { method: "DELETE" });
                router.push("/dashboard");
              },
            })
          }
        />
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          {error && confirm && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => confirm && void act(confirm.run)}>
              {pending && <Spinner data-icon="inline-start" />}
              {confirm?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteCard({
  projectId,
  inviteToken,
  joinCode,
  onReset,
}: {
  projectId: string;
  inviteToken: string;
  joinCode: string;
  onReset: () => void;
}) {
  const { copied, copy } = useCopy();
  // The origin is only known in the browser; reading it after mount keeps server and client markup equal.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/join/${inviteToken}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite people</CardTitle>
        <CardDescription>
          Anyone with the link or code joins as a member. Reset them to stop new people joining with the old ones.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            Reset
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {[
            { id: `${projectId}-link`, label: "Invite link", value: link, mono: false },
            { id: `${projectId}-code`, label: "Join code", value: joinCode, mono: true },
          ].map((item) => (
            <Field key={item.id}>
              <FieldLabel htmlFor={item.id}>{item.label}</FieldLabel>
              <div className="flex gap-2">
                <Input id={item.id} value={item.value} readOnly className={item.mono ? "font-mono" : undefined} />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={copied === item.id ? "Copied" : `Copy ${item.label.toLowerCase()}`}
                  onClick={() => void copy(item.id, item.value)}
                >
                  {copied === item.id ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                </Button>
              </div>
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ProjectCard({
  project,
  taskTypesHref,
  onDelete,
}: {
  project: SettingsProject;
  taskTypesHref: string;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project</CardTitle>
        <CardDescription>
          The name everyone sees. Task types and their points live on the{" "}
          <Link href={taskTypesHref} className="font-medium text-primary-deep underline-offset-4 hover:underline">
            Task types
          </Link>{" "}
          page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={rename}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="project-rename">Name</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="project-rename"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={60}
                  aria-invalid={error ? true : undefined}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending || name.trim().length < 2 || name.trim() === project.name}
                >
                  {pending && <Spinner data-icon="inline-start" />}
                  Save name
                </Button>
              </div>
              {error && <FieldError>{error}</FieldError>}
            </Field>
            {project.role === "owner" && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Deleting the project removes all of its work and points for everyone.
                </p>
                <Button type="button" variant="destructive" onClick={onDelete}>
                  Delete project
                </Button>
              </div>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
