"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProjectRole } from "@prisma/client";
import {
  CheckIcon,
  CoinsIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useCopy } from "@/components/agents/useCopy";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectBriefCard, type Brief } from "@/components/projects/ProjectBrief";
import { ProjectMembersCard, type SettingsMember } from "@/components/projects/ProjectMembersCard";
import { PointSettingsCard } from "@/components/projects/PointSettings";
import { TransferOwnership } from "@/components/projects/TransferOwnership";
import { TaskTypesView } from "@/components/task-types/TaskTypesView";
import { requestJson } from "@/lib/request-json";

type SettingsProject = {
  id: string;
  name: string;
  slug: string;
  role: ProjectRole;
  joinCode: string | null;
  inviteToken: string | null;
  brief: Brief;
  memberCount: number;
  createdAt: string;
};

type Confirm = { title: string; description: string; action: string; run: () => Promise<void> };

const ROLE_NAME: Record<ProjectRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };

type TabId = "general" | "brief" | "members" | "points" | "task-types" | "data" | "danger";
export function ProjectSettings({
  project,
  members,
  eligibleMembers,
  currentUserId,
}: {
  project: SettingsProject;
  members: SettingsMember[];
  eligibleMembers: { userId: string; name: string | null; email: string | null }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canManage } = useProject();
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

  const changeRole = (member: SettingsMember, role: ProjectRole) =>
    act(async () => {
      await requestJson(`/api/projects/${project.id}/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    });

  const removeMember = (member: SettingsMember) => {
    const leaving = member.userId === currentUserId;
    setError(null);
    setConfirm({
      title: leaving ? "Leave this project?" : `Remove ${member.name ?? member.email ?? "this member"}?`,
      description: leaving
        ? "You'll lose access to its tasks and scoreboard, and your agents here are deleted."
        : "They lose access straight away, and their agents in this project are deleted. Their points stay in the ledger.",
      action: leaving ? "Leave project" : "Remove",
      run: async () => {
        await requestJson(`/api/projects/${project.id}/members/${member.userId}`, { method: "DELETE" });
        if (leaving) router.push("/dashboard");
      },
    });
  };

  // Tabs a role can't use are left out entirely, and a link to one falls back to General.
  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "general", label: "General", icon: Settings2Icon },
    { id: "brief", label: "Brief", icon: FileTextIcon },
    { id: "members", label: "Members", icon: UsersIcon },
    { id: "points", label: "Points", icon: CoinsIcon },
    ...(canManage ? [{ id: "task-types" as const, label: "Task types", icon: SlidersHorizontalIcon }] : []),
    ...(canManage ? [{ id: "data" as const, label: "Data & Ownership", icon: DatabaseIcon }] : []),
    ...(isOwner ? [{ id: "danger" as const, label: "Danger Zone", icon: TriangleAlertIcon }] : []),
  ];
  const requested = searchParams.get("tab");
  const tab = tabs.find((item) => item.id === requested)?.id ?? "general";

  function openTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    // Pushed rather than replaced, so Back and Forward step through the sections someone opened.
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // A deep link can land on a section whose pill sits off-screen in the mobile tab strip.
  useEffect(() => {
    document
      .querySelector('[data-settings-tabs] [aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  return (
    <div className="grid gap-4">
      {error && !confirm && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={openTab} className="gap-4">
        <TabsList
          aria-label="Project settings sections"
          data-settings-tabs=""
          className="w-full justify-start gap-1 self-start overflow-x-auto border border-border p-1 group-data-horizontal/tabs:h-12 sm:w-fit"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-full flex-none gap-2 px-3 text-sm font-semibold text-muted-foreground data-active:text-foreground data-active:[&>svg]:text-primary-deep md:px-4"
            >
              <Icon aria-hidden="true" className="hidden size-[18px] sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Kept mounted so half-typed briefs and point changes survive switching sections. */}
        <TabsContent value="general" forceMount className="data-[state=inactive]:hidden">
          <GeneralCard project={project} onOpenTaskTypes={() => openTab("task-types")} canManage={canManage} />
        </TabsContent>

        <TabsContent value="brief" forceMount className="data-[state=inactive]:hidden">
          <ProjectBriefCard projectId={project.id} brief={project.brief} canEdit={canManage} />
        </TabsContent>

        <TabsContent value="members" forceMount className="data-[state=inactive]:hidden">
          <div className="grid gap-4">
            <ProjectMembersCard
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
              canManage={canManage}
              pending={pending}
              onChangeRole={(member, role) => void changeRole(member, role)}
              onRemove={removeMember}
            />
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
          </div>
        </TabsContent>

        <TabsContent value="points" forceMount className="data-[state=inactive]:hidden">
          <PointSettingsCard />
        </TabsContent>

        {canManage && (
          // Loads its list when opened; nothing half-typed lives outside its dialog, so it needn't stay mounted.
          <TabsContent value="task-types">
            <TaskTypesView />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="data" forceMount className="data-[state=inactive]:hidden">
            <div className="grid gap-4">
              <BackupCard projectId={project.id} />
              {isOwner && <TransferOwnership projectId={project.id} members={eligibleMembers} />}
            </div>
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="danger" forceMount className="data-[state=inactive]:hidden">
            <DangerCard
              project={project}
              onDelete={() =>
                setConfirm({
                  title: `Delete ${project.name}?`,
                  description:
                    "This deletes its tasks, agents, points and marketing records for everyone. It can't be undone.",
                  action: "Delete project",
                  run: async () => {
                    await requestJson(`/api/projects/${project.id}`, { method: "DELETE" });
                    router.push("/dashboard");
                  },
                })
              }
            />
          </TabsContent>
        )}
      </Tabs>

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

function GeneralCard({
  project,
  onOpenTaskTypes,
  canManage,
}: {
  project: SettingsProject;
  onOpenTaskTypes: () => void;
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== project.name;

  async function rename(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await requestJson(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      setSaved(true);
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
        <CardTitle>General</CardTitle>
        <CardDescription>
          The name everyone sees.
          {canManage && (
            <>
              {" "}
              Task types and their points have their own{" "}
              <button
                type="button"
                onClick={onOpenTaskTypes}
                className="font-medium text-primary-deep underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                Task types
              </button>{" "}
              tab.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canManage ? (
          <form onSubmit={(event) => void rename(event)}>
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
                  <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2 || !dirty}>
                    {pending && <Spinner data-icon="inline-start" />}
                    Save name
                  </Button>
                  <span className="text-[13px] text-muted-foreground sm:self-center" aria-live="polite">
                    {saved && !dirty ? "Saved" : ""}
                  </span>
                </div>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <div className="grid gap-1">
            <span className="text-[13px] font-semibold text-foreground">Name</span>
            <p className="m-0 text-sm text-foreground">{project.name}</p>
            <p className="m-0 text-[13px] text-muted-foreground">Only owners and admins can rename the project.</p>
          </div>
        )}

        <dl className="m-0 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <div className="grid gap-1">
            <dt className="text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">Your role</dt>
            <dd className="m-0 text-sm font-semibold text-foreground">{ROLE_NAME[project.role]}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">Members</dt>
            <dd className="m-0 text-sm font-semibold text-foreground tabular-nums">{project.memberCount}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-2xs font-bold tracking-[0.07em] text-muted-foreground uppercase">Created</dt>
            <dd className="m-0 font-mono text-sm text-foreground tabular-nums">{project.createdAt.slice(0, 10)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
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

function DangerCard({ project, onDelete }: { project: SettingsProject; onDelete: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Delete project</CardTitle>
        <CardDescription>
          Deleting {project.name} removes its tasks, agents, points and marketing records for everyone. It can&apos;t be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="destructive" onClick={onDelete}>
          Delete project
        </Button>
      </CardContent>
    </Card>
  );
}

function BackupCard({ projectId }: { projectId: string }) {
  const [downloadingFormat, setDownloadingFormat] = useState<"xlsx" | "json" | null>(null);

  const handleDownload = async (format: "xlsx" | "json") => {
    if (downloadingFormat) return;
    setDownloadingFormat(format);
    try {
      const res = await fetch(`/api/admin/export?projectId=${projectId}&format=${format}`);
      if (!res.ok) {
        throw new Error(`Failed to export data: ${res.statusText}`);
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `backup-${projectId}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.location.href = `/api/admin/export?projectId=${projectId}&format=${format}`;
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Backup & Export</CardTitle>
        <CardDescription>
          Download a complete snapshot of this project&apos;s tasks, points ledger, comments, members, and configurations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Download your project data for spreadsheet analysis or disaster recovery backup.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              disabled={downloadingFormat !== null}
              onClick={() => handleDownload("xlsx")}
            >
              {downloadingFormat === "xlsx" ? (
                <Spinner className="mr-2" />
              ) : (
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {downloadingFormat === "xlsx" ? "Generating .xlsx..." : "Spreadsheet (.xlsx)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={downloadingFormat !== null}
              onClick={() => handleDownload("json")}
            >
              {downloadingFormat === "json" ? (
                <Spinner className="mr-2" />
              ) : (
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {downloadingFormat === "json" ? "Generating JSON..." : "JSON backup"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
