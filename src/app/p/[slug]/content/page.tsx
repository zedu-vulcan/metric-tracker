"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FileText,
  Lightbulb,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { ContentFormDialog, type ContentApiItem, type ContentStatus, type ContentType } from "@/components/content/ContentFormDialog";
import { WeeklyBars, countPerWeek, lastWeeks } from "@/components/charts/WeeklyCharts";
import { KpiCard, KpiGrid, type Delta } from "@/components/KpiCard";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { PillSelect, SearchPill, Toolbar, ToolbarGroup } from "@/components/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/request-json";

type ContentRow = {
  id: string;
  title: string;
  url: string;
  type: ContentType | "";
  platform: string;
  topics: string[];
  status: ContentStatus;
  created: string;
  updated: string;
  publishDate: string | null;
  views: number;
  notes: string;
  item: ContentApiItem;
};

const STATUS_BADGE: Record<ContentStatus, "success" | "warning" | "info" | "secondary"> = {
  Published: "success",
  Draft: "warning",
  Scheduled: "info",
  Idea: "secondary",
  Archived: "secondary",
};

const CONTENT_TYPE_ICON: Record<ContentType, LucideIcon> = {
  Article: FileText,
  "Social post": MessageCircle,
  Video: Clapperboard,
  Newsletter: Mail,
};

const DAY_MS = 86_400_000;
const CHART_WEEKS = 12;
const PAGE_SIZE = 15;

function growthDelta(current: number, previous: number): Delta {
  const added = current - previous;
  if (added === 0) return { label: "0%", direction: "flat", favorable: true };
  const label =
    previous === 0
      ? `${added > 0 ? "+" : "−"}${Math.abs(added).toLocaleString()}`
      : `${added > 0 ? "+" : "−"}${((Math.abs(added) / previous) * 100).toFixed(1)}%`;
  return { label, direction: added > 0 ? "up" : "down", favorable: added > 0 };
}

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateForRow(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function contentItemToRow(item: ContentApiItem): ContentRow {
  return {
    id: item.id,
    title: item.title ?? "",
    url: item.url ?? "",
    type: item.type ?? "",
    platform: item.platform ?? "",
    topics: item.topics,
    status: item.status,
    created: formatDateForRow(item.createdDate),
    updated: formatDateForRow(item.updatedDate ?? item.publishDate ?? ""),
    publishDate: item.publishDate,
    views: item.views,
    notes: item.notes ?? "",
    item,
  };
}

export default function ContentTrackerPage() {
  const [rowsState, setRowsState] = useState<ContentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentApiItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, topicFilter, statusFilter, sortOrder]);
  useEffect(() => {
    let isCurrent = true;

    async function loadContent() {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await apiFetch("/api/content", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load content. Please try again.");
        const items = (await response.json()) as ContentApiItem[];
        if (isCurrent) setRowsState(items.map(contentItemToRow));
      } catch (error) {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : "Could not load content. Please try again.");
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadContent();
    return () => {
      isCurrent = false;
    };
  }, [reloadKey]);

  const openAddDialog = () => {
    setEditingItem(null);
    setIsOpen(true);
  };

  const openEditDialog = (row: ContentRow) => {
    setEditingItem(row.item);
    setIsOpen(true);
  };

  const handleSaved = (saved: ContentApiItem, mode: "created" | "updated") => {
    const savedRow = contentItemToRow(saved);
    setRowsState((previous) =>
      mode === "updated" ? previous.map((row) => (row.id === saved.id ? savedRow : row)) : [savedRow, ...previous]
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const response = await apiFetch(`/api/content/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete content. Please try again.");
      setRowsState((previous) => previous.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete content. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRows = rowsState
    .filter((row) => {
      const query = searchQuery.trim().toLocaleLowerCase();
      const matchesSearch =
        !query ||
        [row.title, row.url, row.type, row.topics.join(" "), row.status, row.notes]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      const rowTypeFilter = row.type === "Social post" ? "social" : row.type.toLocaleLowerCase();
      const matchesType = typeFilter === "all" || rowTypeFilter === typeFilter;
      const matchesTopic = topicFilter === "all" || row.topics.includes(topicFilter);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "in-progress"
          ? row.status === "Draft" || row.status === "Scheduled"
          : row.status.toLocaleLowerCase() === statusFilter);
      return matchesSearch && matchesType && matchesTopic && matchesStatus;
    })
    .sort((first, second) => {
      const dateDifference = parseDate(first.created) - parseDate(second.created);
      return sortOrder === "newest" ? -dateDifference : dateDifference;
    });
  const availableTopics = Array.from(new Set(rowsState.flatMap((row) => row.topics))).sort();
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  const monthAgo = Date.now() - 30 * DAY_MS;
  const published = rowsState.filter((row) => row.status === "Published");
  const drafts = rowsState.filter((row) => row.status === "Draft").length;
  const scheduled = rowsState.filter((row) => row.status === "Scheduled").length;
  const addedThisMonth = rowsState.filter((row) => parseDate(row.created) >= monthAgo).length;
  const publishedThisMonth = published.filter((row) => row.publishDate && parseDate(row.publishDate) >= monthAgo).length;
  const totalViews = rowsState.reduce((sum, row) => sum + row.views, 0);
  const showFigures = !isLoading && !loadError;
  const chartWeeks = lastWeeks(CHART_WEEKS);
  const createdPerWeek = countPerWeek(
    chartWeeks,
    rowsState.map((row) => new Date(`${row.item.createdDate}T00:00:00Z`))
  );
  const createdInRange = createdPerWeek.reduce((sum, count) => sum + count, 0);

  const hasActiveFilters =
    searchQuery !== "" ||
    typeFilter !== "all" ||
    topicFilter !== "all" ||
    statusFilter !== "all" ||
    sortOrder !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setTopicFilter("all");
    setStatusFilter("all");
    setSortOrder("newest");
  };

  return (
    <>
      <PageHeader
        title="Content"
        description="Every article, post, video and newsletter the team is working on, from idea to published."
        actions={
          <Button onClick={openAddDialog}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add content
          </Button>
        }
      />

      <PageContent>
        <KpiGrid>
          <KpiCard
            title="Total pieces"
            value={showFigures ? rowsState.length.toLocaleString() : "–"}
            delta={showFigures ? growthDelta(rowsState.length, rowsState.length - addedThisMonth) : undefined}
            comparison="vs 30 days ago"
            action={{ label: "Show all content", onClick: clearFilters }}
          />
          <KpiCard
            title="Published"
            value={showFigures ? published.length.toLocaleString() : "–"}
            delta={showFigures ? growthDelta(published.length, published.length - publishedThisMonth) : undefined}
            comparison="vs 30 days ago"
            action={{
              label: "Show published content",
              onClick: () => {
                clearFilters();
                setStatusFilter("published");
              },
            }}
          />
          <KpiCard
            title="Drafts & scheduled"
            value={showFigures ? (drafts + scheduled).toLocaleString() : "–"}
            context={showFigures ? `${scheduled.toLocaleString()} scheduled · ${drafts.toLocaleString()} drafts` : undefined}
            action={{
              label: "Show drafts and scheduled content",
              onClick: () => {
                clearFilters();
                setStatusFilter("in-progress");
              },
            }}
          />
          <KpiCard
            title="Total views"
            value={showFigures ? totalViews.toLocaleString() : "–"}
            context={showFigures ? "Manually updated across all content" : undefined}
          />
        </KpiGrid>

        {loadError && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Toolbar>
          <ToolbarGroup className="md:flex-1">
            <SearchPill value={searchQuery} onChange={setSearchQuery} placeholder="Search titles, topics, notes" />
          </ToolbarGroup>
          <ToolbarGroup>
            <PillSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All" },
                { value: "article", label: "Article" },
                { value: "social", label: "Social post" },
                { value: "video", label: "Video" },
                { value: "newsletter", label: "Newsletter" },
              ]}
            />
            <PillSelect
              label="Topic"
              value={topicFilter}
              onChange={setTopicFilter}
              options={[{ value: "all", label: "All" }, ...availableTopics.map((topic) => ({ value: topic, label: topic }))]}
            />
            <PillSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "idea", label: "Idea" },
                { value: "draft", label: "Draft" },
                { value: "scheduled", label: "Scheduled" },
                { value: "in-progress", label: "Draft or scheduled" },
                { value: "published", label: "Published" },
                { value: "archived", label: "Archived" },
              ]}
            />
            <PillSelect
              label="Sort"
              value={sortOrder}
              onChange={(value) => setSortOrder(value as "newest" | "oldest")}
              defaultValue="newest"
              options={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
              ]}
            />
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={clearFilters} className="shrink-0">
                <X data-icon="inline-start" aria-hidden="true" />
                Clear
              </Button>
            )}
          </ToolbarGroup>
        </Toolbar>

        <section aria-labelledby="content-table-title" className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="content-table-title" className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">
              All content
            </h2>
            {!isLoading && !loadError && (
              <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
                {filteredRows.length === rowsState.length
                  ? `${rowsState.length.toLocaleString()} ${rowsState.length === 1 ? "piece" : "pieces"}`
                  : `${filteredRows.length.toLocaleString()} of ${rowsState.length.toLocaleString()} pieces`}
              </p>
            )}
          </div>

          {!isLoading && !loadError && filteredRows.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed py-12">
              <EmptyHeader>
                <EmptyTitle>{rowsState.length === 0 ? "No content yet" : "No content matches"}</EmptyTitle>
                <EmptyDescription>
                  {rowsState.length === 0
                    ? "Add your first article, post, video or newsletter to start tracking it."
                    : "Try a different search, or clear the filters."}
                </EmptyDescription>
              </EmptyHeader>
              {rowsState.length === 0 ? (
                <Button onClick={openAddDialog}>
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Add content
                </Button>
              ) : (
                <Button variant="outline" onClick={clearFilters}>
                  <X data-icon="inline-start" aria-hidden="true" />
                  Clear filters
                </Button>
              )}
            </Empty>
          ) : (
            <Table variant="pill" aria-labelledby="content-table-title" aria-busy={isLoading}>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Topics</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Views</TableHead>
                  <TableHead className="hidden xl:table-cell">Updated</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Notes</TableHead>
                  <TableHead className="w-12 px-1! sm:px-2!">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="hidden size-9 shrink-0 rounded-xl min-[420px]:block" />
                            <div className="flex flex-col gap-1.5">
                              <Skeleton className="h-3.5 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-3.5 w-16" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-3.5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-3.5 w-20" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="ml-auto h-3.5 w-12" /></TableCell>
                        <TableCell className="hidden xl:table-cell"><Skeleton className="h-3.5 w-20" /></TableCell>
                        <TableCell className="hidden 2xl:table-cell"><Skeleton className="h-3.5 w-24" /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))
                  : pagedRows.map((row) => {
                      const TypeIcon = row.type ? CONTENT_TYPE_ICON[row.type] : row.status === "Idea" ? Lightbulb : FileText;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex w-[150px] min-w-0 items-center gap-2.5 sm:w-[300px] sm:gap-3 2xl:w-[360px]">
                              <span className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-deep min-[420px]:flex">
                                <TypeIcon className="size-4.5" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p className={cn("m-0 truncate font-semibold", row.title ? "text-foreground" : "text-muted-foreground")}>
                                  {row.title || "Untitled"}
                                </p>
                                <p className="m-0 truncate text-xs text-muted-foreground">
                                  {row.url || (row.status === "Idea" ? "Idea" : "No link yet")}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={cn("hidden md:table-cell", row.type ? "text-foreground" : "text-faint-foreground")}>
                            {row.type || "–"}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            <span className="block max-w-[160px] truncate">{row.topics.length ? row.topics.join(", ") : "–"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[row.status]}>
                              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">{row.created}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">{row.views.toLocaleString()}</TableCell>
                          <TableCell className="hidden text-muted-foreground xl:table-cell">{row.updated}</TableCell>
                          <TableCell
                            className={cn(
                              "hidden 2xl:table-cell",
                              row.notes ? "text-muted-foreground" : "text-faint-foreground"
                            )}
                          >
                            <span className="block max-w-[220px] truncate">{row.notes || "–"}</span>
                          </TableCell>
                          <TableCell className="px-1! text-right sm:px-2!">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                type="button"
                                aria-label={`Actions for ${row.title || "untitled content"}`}
                                className={cn(
                                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                                  "pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100 aria-expanded:opacity-100"
                                )}
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onSelect={() => openEditDialog(row)}>
                                  <Pencil aria-hidden="true" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(row)}>
                                  <Trash2 aria-hidden="true" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredRows.length > PAGE_SIZE && (
            <nav aria-label="Content pages" className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
                {pageStart + 1}–{pageStart + pagedRows.length} of {filteredRows.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span className="min-w-14 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">
                  {currentPage} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </section>

        <section
          aria-labelledby="content-created-title"
          className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="content-created-title" className="m-0 text-[17px] leading-tight font-bold tracking-[-0.02em] text-foreground">
                Content created
              </h2>
              <p className="m-0 text-[13px] text-muted-foreground">Pieces added each week, last {CHART_WEEKS} weeks</p>
            </div>
            {showFigures && (
              <p className="m-0 text-[26px] leading-none font-extrabold tracking-[-0.04em] text-foreground tabular-nums">
                {createdInRange}
              </p>
            )}
          </div>
          {showFigures ? (
            <WeeklyBars
              weeks={chartWeeks}
              counts={createdPerWeek}
              label={`Content created per week over the last ${CHART_WEEKS} weeks`}
            />
          ) : (
            <Skeleton className="h-52 w-full rounded-2xl" />
          )}
        </section>

        <ContentFormDialog
          open={isOpen}
          onOpenChange={setIsOpen}
          item={editingItem}
          knownTopics={availableTopics}
          onSaved={handleSaved}
        />

        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
              setDeleteError("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive-muted text-destructive">
                <Trash2 aria-hidden="true" className="size-5" />
              </div>
              <DialogTitle className="text-xl">Delete content?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this content? This action cannot be undone. The content will be permanently removed from your tracker.
              </DialogDescription>
            </DialogHeader>
            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
            {deleteTarget && (
              <div className="rounded-lg border border-destructive/20 bg-destructive-muted/40 px-4 py-3">
                <p className="font-semibold text-foreground">{deleteTarget.title || "Untitled"}</p>
                {deleteTarget.url && <p className="mt-1 truncate text-xs text-muted-foreground">{deleteTarget.url}</p>}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
                {isDeleting ? <Spinner data-icon="inline-start" /> : <Trash2 aria-hidden="true" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </>
  );
}
