"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { PillSelect, SearchPill, Toolbar, ToolbarGroup } from "@/components/Toolbar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MarkFeaturedDialog } from "./MarkFeaturedDialog";
import { OutletDetailsDialog } from "./OutletDetailsDialog";
import { PressFormDialog } from "./PressFormDialog";
import {
  ARTICLE_TYPES,
  articleTypeLabel,
  deriveItems,
  formatDate,
  groupByOutlet,
  isFollowUpDue,
  outletKey,
  parseDate,
  submissionPayload,
  today,
  sendJson,
  type ApiRecord,
  type OutletDetails,
  type OutletSummary,
  type PressItem,
  type Stage,
} from "./press-model";
import { apiFetch } from "@/lib/request-json";

type View = "outlets" | "featured" | "pipeline";
type BadgeVariant = "success" | "info" | "warning" | "destructive" | "secondary";

const ITEM_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  Draft: { label: "Target", variant: "secondary" },
  Submitted: { label: "Pitched", variant: "info" },
  "Under Review": { label: "Under review", variant: "info" },
  "Changes Requested": { label: "Changes requested", variant: "warning" },
  Accepted: { label: "Accepted", variant: "success" },
  Published: { label: "Featured", variant: "success" },
  Rejected: { label: "Rejected", variant: "destructive" },
  Withdrawn: { label: "Withdrawn", variant: "secondary" },
};

const OUTLET_BADGE: Record<Stage, { label: string; variant: BadgeVariant }> = {
  Featured: { label: "Featured", variant: "success" },
  Pitched: { label: "Pitched", variant: "info" },
  Target: { label: "Target", variant: "secondary" },
  Closed: { label: "Closed", variant: "destructive" },
};

function StatusBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hidden size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-[13px] font-extrabold text-primary-deep min-[420px]:flex",
        className
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

const actionsTrigger = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100 aria-expanded:opacity-100"
);

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function PressMediaDashboard() {
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [outletDetails, setOutletDetails] = useState<OutletDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [view, setView] = useState<View>("outlets");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [form, setForm] = useState<{ item: PressItem | null; stage: Stage; outlet: string } | null>(null);
  const [featuring, setFeaturing] = useState<PressItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PressItem | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [mediaResponse, outletsResponse] = await Promise.all([
        apiFetch("/api/media", { cache: "no-store" }),
        apiFetch("/api/media/outlets", { cache: "no-store" }),
      ]);
      if (!mediaResponse.ok || !outletsResponse.ok) throw new Error();
      const data = (await mediaResponse.json()) as { records?: ApiRecord[] };
      const outletData = (await outletsResponse.json()) as OutletDetails[];
      setRecords(Array.isArray(data.records) ? data.records : []);
      setOutletDetails(Array.isArray(outletData) ? outletData : []);
    } catch {
      setLoadError("Couldn't load your press list. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const afterSave = (message: string) => {
    setNotice(message);
    setActionError("");
    void loadRecords();
  };

  const items = useMemo(() => deriveItems(records), [records]);
  const outlets = useMemo(() => groupByOutlet(items), [items]);
  const outletDetailsByKey = useMemo(
    () => new Map(outletDetails.map((outlet) => [outletKey(outlet.name), outlet])),
    [outletDetails]
  );

  const saveOutletDetails = (updated: OutletDetails) => {
    setOutletDetails((previous) => previous.map((outlet) => (outlet.id === updated.id ? updated : outlet)));
    // A rename also renames the outlet on its coverage and pitches, so reload those too.
    afterSave(`${updated.name} details updated.`);
  };

  const featured = items.filter((item) => item.stage === "Featured");
  const pitched = items.filter((item) => item.stage === "Pitched");
  const targets = items.filter((item) => item.stage === "Target");
  const followUpsDue = pitched.filter(isFollowUpDue).length;
  const year = new Date().getFullYear();
  const coverageThisYear = featured.filter((item) => parseDate(item.date)?.getFullYear() === year).length;
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const firstFeature = new Map<string, Date>();
  for (const item of featured) {
    const key = outletKey(item.outlet);
    const date = parseDate(item.date);
    if (date && (!firstFeature.has(key) || date < (firstFeature.get(key) as Date))) firstFeature.set(key, date);
  }
  const newOutlets = [...firstFeature.values()].filter((date) => date >= monthAgo).length;
  const outletsFeatured = outlets.filter((outlet) => outlet.stage === "Featured").length;
  const outletsTargeted = outlets.filter((outlet) => outlet.stage === "Target").length;

  const query = search.trim().toLocaleLowerCase();
  const matchesQuery = (text: string) => !query || text.toLocaleLowerCase().includes(query);
  const visibleOutlets = outlets.filter((outlet) => matchesQuery(outlet.name));
  const filterItems = (list: PressItem[]) =>
    list.filter(
      (item) =>
        matchesQuery(`${item.outlet} ${item.title} ${item.owner ?? ""}`) &&
        (typeFilter === "all" || item.articleType === typeFilter)
    );
  const visibleFeatured = filterItems(featured).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const visiblePipeline = filterItems(items.filter((item) => item.stage !== "Featured"))
    .filter((item) => stageFilter === "all" || item.stage === stageFilter)
    .sort(
      (a, b) =>
        Number(isFollowUpDue(b)) - Number(isFollowUpDue(a)) ||
        ["Pitched", "Target", "Closed"].indexOf(a.stage) - ["Pitched", "Target", "Closed"].indexOf(b.stage) ||
        (b.date ?? "").localeCompare(a.date ?? "")
    );

  const hasFilters = search !== "" || typeFilter !== "all" || stageFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStageFilter("all");
  };

  const show = (next: View, stage = "all", outlet = "") => {
    setView(next);
    setTypeFilter("all");
    setStageFilter(stage);
    setSearch(outlet);
  };

  const openForm = (item: PressItem | null, stage: Stage = "Target", outlet = "") => setForm({ item, stage, outlet });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const ids = [deleteTarget.coverage?.id, deleteTarget.submission?.id].filter(Boolean) as string[];
      for (const id of ids) {
        const response = await apiFetch(`/api/media/${id}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error();
      }
      setDeleteTarget(null);
      afterSave(`${deleteTarget.outlet} removed.`);
    } catch {
      setActionError("Couldn't delete that. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const reopen = async (item: PressItem) => {
    if (!item.submission) return;
    try {
      await sendJson(`/api/media/${item.submission.id}`, "PUT", submissionPayload(item.submission, { status: "Submitted" }));
      afterSave(`${item.outlet} is back in progress.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Couldn't update that. Please try again.");
    }
  };

  const exportCsv = () => {
    const rows = view === "featured" ? visibleFeatured : view === "pipeline" ? visiblePipeline : items;
    const header = ["Outlet", "Title", "Stage", "Status", "Type", "Date", "Follow up", "Owner", "Link", "Notes"];
    const lines = rows.map((item) =>
      [
        item.outlet,
        item.title,
        item.stage,
        ITEM_BADGE[item.status]?.label ?? item.status,
        articleTypeLabel(item),
        item.date ?? "",
        item.followUpDate ?? "",
        item.owner ?? "",
        item.url ?? "",
        item.notes ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob(["﻿", [header.map(csvCell).join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `press-${today()}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const figure = (value: number) => (isLoading || loadError ? "–" : value.toLocaleString());

  return (
    <>
      <PageHeader
        title="Press & Media"
        description="Where you've been featured, and where you're working to be featured next."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={isLoading || items.length === 0}>
              <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              Export
            </Button>
            <Button onClick={() => openForm(null)}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Add press
            </Button>
          </>
        }
      />

      <PageContent>
        {notice && (
          <Alert role="status">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {(loadError || actionError) && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{loadError || actionError}</span>
              {loadError ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void loadRecords()}>
                  Try again
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setActionError("")}>
                  Dismiss
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <KpiGrid>
          <KpiCard
            title="Outlets featured in"
            value={figure(outletsFeatured)}
            delta={
              isLoading || loadError
                ? undefined
                : { label: `+${newOutlets}`, direction: newOutlets > 0 ? "up" : "flat", favorable: true }
            }
            comparison="new in the last 30 days"
            action={{ label: "Show where you've been featured", onClick: () => show("featured") }}
          />
          <KpiCard
            title="Pieces of coverage"
            value={figure(featured.length)}
            context={isLoading || loadError ? undefined : `${coverageThisYear} published this year`}
            action={{ label: "Show all coverage", onClick: () => show("featured") }}
          />
          <KpiCard
            title="Pitches in progress"
            value={figure(pitched.length)}
            context={
              isLoading || loadError ? undefined : followUpsDue > 0 ? (
                <span className="font-semibold text-warning">
                  {followUpsDue} {followUpsDue === 1 ? "follow-up" : "follow-ups"} due
                </span>
              ) : (
                "No follow-ups due"
              )
            }
            action={{ label: "Show pitches in progress", onClick: () => show("pipeline", "Pitched") }}
          />
          <KpiCard
            title="Targets"
            value={figure(targets.length)}
            context={isLoading || loadError ? undefined : `${outletsTargeted} ${outletsTargeted === 1 ? "outlet" : "outlets"} not pitched yet`}
            action={{ label: "Show targets", onClick: () => show("pipeline", "Target") }}
          />
        </KpiGrid>

        <Tabs value={view} onValueChange={(value) => setView(value as View)} className="gap-4">
          <Toolbar>
            <ToolbarGroup className="md:flex-1">
              <TabsList className="h-10! shrink-0 p-1">
                <TabsTrigger value="outlets" className="px-4">
                  Outlets
                </TabsTrigger>
                <TabsTrigger value="featured" className="px-4">
                  Featured
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="px-4">
                  Targets & pitches
                </TabsTrigger>
              </TabsList>
            </ToolbarGroup>
            <ToolbarGroup>
              <SearchPill
                value={search}
                onChange={setSearch}
                placeholder={view === "outlets" ? "Search outlets" : "Search outlet or story"}
                className="md:w-60"
              />
              {view === "pipeline" && (
                <PillSelect
                  label="Stage"
                  value={stageFilter}
                  onChange={setStageFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "Target", label: "Target" },
                    { value: "Pitched", label: "Pitched" },
                    { value: "Closed", label: "Closed" },
                  ]}
                />
              )}
              {view !== "outlets" && (
                <PillSelect
                  label="Type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[{ value: "all", label: "All" }, ...ARTICLE_TYPES.map((type) => ({ value: type, label: type }))]}
                />
              )}
              {hasFilters && (
                <Button type="button" variant="ghost" onClick={clearFilters} className="shrink-0">
                  <XIcon data-icon="inline-start" aria-hidden="true" />
                  Clear
                </Button>
              )}
            </ToolbarGroup>
          </Toolbar>

          <TabsContent value="outlets">
            <TableCard
              title="Outlets"
              count={isLoading ? null : `${visibleOutlets.length} ${visibleOutlets.length === 1 ? "outlet" : "outlets"}`}
              isLoading={isLoading}
              isEmpty={!isLoading && !loadError && visibleOutlets.length === 0}
              empty={
                outlets.length === 0
                  ? { title: "No outlets yet", text: "Add the outlets you've been featured in, or want to be.", action: () => openForm(null) }
                  : { title: "No outlets match", text: "Try a different search.", clear: clearFilters }
              }
            >
              <Table variant="pill" aria-label="Outlets">
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Tier</TableHead>
                    <TableHead className="hidden lg:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Features</TableHead>
                    <TableHead className="hidden lg:table-cell">In progress</TableHead>
                    <TableHead className="hidden sm:table-cell">Last activity</TableHead>
                    <TableHead className="w-12 px-1! sm:px-2!">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOutlets.map((outlet) => (
                    <OutletRow
                      key={outlet.key}
                      outlet={outlet}
                      details={outletDetailsByKey.get(outlet.key)}
                      onOpen={() => show(outlet.stage === "Featured" ? "featured" : "pipeline", "all", outlet.name)}
                      onEditDetails={setSelectedOutlet}
                      onAddPitch={() => openForm(null, "Pitched", outlet.name)}
                      onAddFeature={() => openForm(null, "Featured", outlet.name)}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </TabsContent>

          <TabsContent value="featured">
            <TableCard
              title="Featured"
              count={isLoading ? null : `${visibleFeatured.length} ${visibleFeatured.length === 1 ? "piece" : "pieces"}`}
              isLoading={isLoading}
              isEmpty={!isLoading && !loadError && visibleFeatured.length === 0}
              empty={
                featured.length === 0
                  ? { title: "No coverage yet", text: "When you get featured, log it here.", action: () => openForm(null, "Featured") }
                  : { title: "No coverage matches", text: "Try a different search, or clear the filters.", clear: clearFilters }
              }
            >
              <Table variant="pill" aria-label="Featured coverage">
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Published</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="w-12 px-1! sm:px-2!">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleFeatured.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <OutletCell name={item.outlet} detail={item.title || "No headline yet"} muted={!item.title} />
                      </TableCell>
                      <TableCell className={cn("hidden md:table-cell", articleTypeLabel(item) ? "text-foreground" : "text-faint-foreground")}>
                        {articleTypeLabel(item) || "–"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(item.date)}</TableCell>
                      <TableCell>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary-deep hover:underline"
                          >
                            Read
                            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-faint-foreground">No link</span>
                        )}
                      </TableCell>
                      <TableCell className="px-1! text-right sm:px-2!">
                        <RowMenu item={item} onEdit={() => openForm(item)} onDelete={() => setDeleteTarget(item)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </TabsContent>

          <TabsContent value="pipeline">
            <TableCard
              title="Targets & pitches"
              count={isLoading ? null : `${visiblePipeline.length} ${visiblePipeline.length === 1 ? "item" : "items"}`}
              isLoading={isLoading}
              isEmpty={!isLoading && !loadError && visiblePipeline.length === 0}
              empty={
                items.every((item) => item.stage === "Featured")
                  ? { title: "Nothing in the pipeline", text: "Add an outlet you'd like to be featured in.", action: () => openForm(null) }
                  : { title: "Nothing matches", text: "Try a different search, or clear the filters.", clear: clearFilters }
              }
            >
              <Table variant="pill" aria-label="Targets and pitches">
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Follow up</TableHead>
                    <TableHead className="hidden xl:table-cell">Owner</TableHead>
                    <TableHead className="hidden lg:table-cell">Pitch sent</TableHead>
                    <TableHead className="hidden md:table-cell">
                      <span className="sr-only">Next step</span>
                    </TableHead>
                    <TableHead className="w-12 px-1! sm:px-2!">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePipeline.map((item) => {
                    const due = isFollowUpDue(item);
                    const badge = ITEM_BADGE[item.status] ?? ITEM_BADGE.Draft;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <OutletCell name={item.outlet} detail={item.title || "No story yet"} muted={!item.title} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge {...badge} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {item.stage === "Pitched" && item.followUpDate ? (
                            <span className={cn(due ? "font-semibold text-warning" : "text-muted-foreground")}>
                              {item.followUpDate === today() ? "Today" : formatDate(item.followUpDate)}
                              {due && item.followUpDate !== today() && " · overdue"}
                            </span>
                          ) : (
                            <span className="text-faint-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className={cn("hidden xl:table-cell", item.owner ? "text-foreground" : "text-faint-foreground")}>
                          {item.owner || "–"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {item.stage === "Target" ? <span className="text-faint-foreground">Not yet</span> : formatDate(item.date)}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {item.stage === "Target" && (
                            <Button variant="outline" size="sm" onClick={() => openForm(item, "Pitched")}>
                              <SendIcon data-icon="inline-start" aria-hidden="true" />
                              Mark as pitched
                            </Button>
                          )}
                          {item.stage === "Pitched" && (
                            <Button variant="outline" size="sm" onClick={() => setFeaturing(item)}>
                              <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
                              Mark as featured
                            </Button>
                          )}
                          {item.stage === "Closed" && (
                            <Button variant="ghost" size="sm" onClick={() => void reopen(item)}>
                              Reopen
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="px-1! text-right sm:px-2!">
                          <RowMenu
                            item={item}
                            onEdit={() => openForm(item, item.stage)}
                            onDelete={() => setDeleteTarget(item)}
                            onPitched={item.stage === "Target" ? () => openForm(item, "Pitched") : undefined}
                            onFeatured={item.stage === "Pitched" ? () => setFeaturing(item) : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableCard>
          </TabsContent>
        </Tabs>

        <PressFormDialog
          open={form !== null}
          onOpenChange={(open) => !open && setForm(null)}
          item={form?.item ?? null}
          startStage={form?.stage}
          outlet={form?.outlet}
          knownOutlets={outlets.map((outlet) => outlet.name)}
          onSaved={afterSave}
        />

        <MarkFeaturedDialog item={featuring} onOpenChange={(open) => !open && setFeaturing(null)} onSaved={afterSave} />

        <OutletDetailsDialog
          outlet={selectedOutlet}
          open={selectedOutlet !== null}
          onOpenChange={(open) => !open && setSelectedOutlet(null)}
          onSaved={saveOutletDetails}
        />

        <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold tracking-[-0.03em]">Remove {deleteTarget?.outlet}?</DialogTitle>
              <DialogDescription>
                {deleteTarget?.coverage && deleteTarget.submission
                  ? "This removes the feature and the pitch that led to it. You can't undo this."
                  : "This removes it from your press list. You can't undo this."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void confirmDelete()}>
                {isDeleting ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" aria-hidden="true" />}
                {isDeleting ? "Removing…" : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </>
  );
}

function TableCard({
  title,
  count,
  isLoading,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  count: string | null;
  isLoading: boolean;
  isEmpty: boolean;
  empty: { title: string; text: string; action?: () => void; clear?: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">{title}</h2>
        {count && <p className="m-0 text-[13px] text-muted-foreground tabular-nums">{count}</p>}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-11 w-full rounded-full" />
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3 px-2">
              <Skeleton className="size-9 rounded-xl" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <Empty className="rounded-2xl border border-dashed py-12">
          <EmptyHeader>
            <EmptyTitle>{empty.title}</EmptyTitle>
            <EmptyDescription>{empty.text}</EmptyDescription>
          </EmptyHeader>
          {empty.action && (
            <Button onClick={empty.action}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Add press
            </Button>
          )}
          {empty.clear && (
            <Button variant="outline" onClick={empty.clear}>
              <XIcon data-icon="inline-start" aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </Empty>
      ) : (
        children
      )}
    </section>
  );
}

function OutletCell({ name, detail, muted }: { name: string; detail: string; muted?: boolean }) {
  return (
    <div className="flex w-[150px] min-w-0 items-center gap-2.5 sm:w-[260px] sm:gap-3 2xl:w-[340px]">
      <Monogram name={name} />
      <div className="min-w-0">
        <p className="m-0 truncate font-semibold text-foreground" title={name}>
          {name}
        </p>
        <p className={cn("m-0 truncate text-xs", muted ? "text-faint-foreground" : "text-muted-foreground")} title={detail}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function websiteHost(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

function OutletRow({
  outlet,
  details,
  onOpen,
  onEditDetails,
  onAddPitch,
  onAddFeature,
}: {
  outlet: OutletSummary;
  details: OutletDetails | undefined;
  onOpen: () => void;
  onEditDetails: (details: OutletDetails) => void;
  onAddPitch: () => void;
  onAddFeature: () => void;
}) {
  const badge = OUTLET_BADGE[outlet.stage];
  const inProgress = [
    outlet.openPitches ? `${outlet.openPitches} ${outlet.openPitches === 1 ? "pitch" : "pitches"}` : "",
    outlet.targets ? `${outlet.targets} ${outlet.targets === 1 ? "idea" : "ideas"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const summary = details
    ? [details.tier, details.contactName ?? details.contactEmail, details.website && websiteHost(details.website)]
        .filter(Boolean)
        .join(" · ")
    : "";
  const contactName = details?.contactName ?? details?.contactEmail;

  return (
    <TableRow
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <TableCell>
        <div className="flex w-[150px] min-w-0 items-center gap-2.5 sm:w-[260px] sm:gap-3">
          <Monogram name={outlet.name} className={outlet.stage === "Featured" ? "bg-primary text-primary-foreground" : undefined} />
          <div className="min-w-0">
            <p className="m-0 truncate font-semibold text-foreground" title={outlet.name}>
              {outlet.name}
            </p>
            <p
              className={cn("m-0 truncate text-xs lg:hidden", summary ? "text-muted-foreground" : "text-faint-foreground")}
              title={summary || undefined}
            >
              {summary || "No contact details yet"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge {...badge} />
      </TableCell>
      <TableCell className={cn("hidden md:table-cell", details?.tier ? "text-foreground" : "text-faint-foreground")}>
        {details?.tier ?? "–"}
      </TableCell>
      <TableCell className="hidden lg:table-cell" onClick={(event) => event.stopPropagation()}>
        {contactName || details?.website ? (
          <div className="flex max-w-[220px] min-w-0 flex-col">
            {contactName && (
              <span className="truncate text-foreground" title={contactName}>
                {contactName}
              </span>
            )}
            {details?.contactName && details.contactEmail && (
              <a href={`mailto:${details.contactEmail}`} className="truncate text-xs text-primary-deep hover:underline">
                {details.contactEmail}
              </a>
            )}
            {details?.website && (
              <a
                href={details.website}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs text-primary-deep hover:underline"
              >
                {websiteHost(details.website)}
              </a>
            )}
          </div>
        ) : (
          <span className="text-faint-foreground">–</span>
        )}
      </TableCell>
      <TableCell className="hidden font-semibold tabular-nums md:table-cell">
        {outlet.features ? outlet.features : <span className="font-normal text-faint-foreground">–</span>}
      </TableCell>
      <TableCell className={cn("hidden lg:table-cell", inProgress ? "text-muted-foreground" : "text-faint-foreground")}>
        {inProgress || "–"}
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(outlet.lastActivity)}</TableCell>
      <TableCell className="px-1! text-right sm:px-2!" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger type="button" aria-label={`Actions for ${outlet.name}`} className={actionsTrigger}>
            <MoreHorizontalIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={!details} onSelect={() => details && onEditDetails(details)}>
              <PencilIcon aria-hidden="true" />
              View or edit details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpen}>
              <ArrowUpRightIcon aria-hidden="true" />
              View details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onAddPitch}>
              <SendIcon aria-hidden="true" />
              Add a pitch
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddFeature}>
              <CircleCheckIcon aria-hidden="true" />
              Log a feature
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function RowMenu({
  item,
  onEdit,
  onDelete,
  onPitched,
  onFeatured,
}: {
  item: PressItem;
  onEdit: () => void;
  onDelete: () => void;
  onPitched?: () => void;
  onFeatured?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={`Actions for ${item.outlet}`} className={actionsTrigger}>
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onPitched && (
          <DropdownMenuItem onSelect={onPitched}>
            <SendIcon aria-hidden="true" />
            Mark as pitched
          </DropdownMenuItem>
        )}
        {onFeatured && (
          <DropdownMenuItem onSelect={onFeatured}>
            <CircleCheckIcon aria-hidden="true" />
            Mark as featured
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon aria-hidden="true" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
