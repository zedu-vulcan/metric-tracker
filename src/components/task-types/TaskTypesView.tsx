"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, RotateCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TaskTypeConfig } from "@/lib/points";
import type { TaskTypeItem } from "@/lib/schemas/task-types";
import { TaskTypeFormDialog } from "./TaskTypeFormDialog";
import { apiFetch } from "@/lib/request-json";

type SaveOutcome = { ok: true } | { ok: false; error: string };

function toConfig(item: TaskTypeItem): TaskTypeConfig {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    points: item.points,
    maxPoints: item.maxPoints,
    isActive: item.isActive,
  };
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; details?: Record<string, string[]> };
    const firstDetail = body.details ? Object.values(body.details).flat()[0] : undefined;
    return firstDetail ?? body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Task types and their points, managed from the Task types tab in project settings. */
export function TaskTypesView() {
  const [items, setItems] = useState<TaskTypeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTypeItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch("/api/task-types?include_archived=true");
      if (!response.ok) throw new Error(`Failed to load task types (${response.status})`);
      setItems((await response.json()) as TaskTypeItem[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load task types.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveType = useCallback(
    async (type: TaskTypeConfig): Promise<SaveOutcome> => {
      const existing = items?.some((item) => item.id === type.id) ?? false;
      const response = await apiFetch(existing ? `/api/task-types/${type.id}` : "/api/task-types", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: type.name,
          slug: type.slug,
          description: type.description ?? null,
          points: type.points,
          maxPoints: type.maxPoints,
          ...(existing ? { isActive: type.isActive } : {}),
        }),
      });
      if (!response.ok) {
        return { ok: false, error: await errorMessage(response, `Save failed (${response.status})`) };
      }
      await load();
      return { ok: true };
    },
    [items, load]
  );

  const toggleActive = useCallback(
    async (item: TaskTypeItem) => {
      const response = await apiFetch(`/api/task-types/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!response.ok) {
        setError(await errorMessage(response, `Update failed (${response.status})`));
        return;
      }
      await load();
    },
    [load]
  );

  const visible = useMemo(
    () => (items ?? []).filter((item) => item.isActive || showArchived),
    [items, showArchived]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Task types
          </CardTitle>
          <CardDescription>
            The kinds of task agents can take on and what each pays. Changes apply to new tasks only.
          </CardDescription>
          <CardAction className="row-span-2 flex flex-wrap items-center justify-end gap-3 self-center">
            <Checkbox
              id="show-archived"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              label="Show archived"
            />
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Add task type
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-2 sm:px-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  <RotateCwIcon data-icon="inline-start" aria-hidden="true" />
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          )}
          {!items && !error && (
            <div className="flex flex-col gap-2 py-1">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          )}

          {items && visible.length === 0 && (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep">
                  <SlidersHorizontalIcon className="size-5" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No task types {showArchived ? "" : "yet"}</EmptyTitle>
                <EmptyDescription>
                  {showArchived
                    ? "Nothing archived."
                    : "Add the first task type so agents know what points are on offer."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {items && visible.length > 0 && (
            <Table variant="pill">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-40">Slug</TableHead>
                  <TableHead className="w-24 text-right">Points</TableHead>
                  <TableHead className="w-24 text-right">Max</TableHead>
                  <TableHead className="w-24 text-center">Active</TableHead>
                  <TableHead className="w-10" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{item.name}</span>
                        {!item.isActive && <Badge variant="secondary">Archived</Badge>}
                      </div>
                      {item.description && <p className="truncate text-xs text-muted-foreground">{item.description}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{item.slug}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground tabular-nums">{item.points}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{item.maxPoints}</TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        id={`active-${item.id}`}
                        checked={item.isActive}
                        onChange={() => void toggleActive(item)}
                        aria-label={`${item.isActive ? "Archive" : "Activate"} ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => {
                          setEditing(item);
                          setDialogOpen(true);
                        }}
                      >
                        <PencilIcon aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TaskTypeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing ? toConfig(editing) : null}
        existing={(items ?? []).map(toConfig)}
        onSave={saveType}
      />
    </>
  );
}
