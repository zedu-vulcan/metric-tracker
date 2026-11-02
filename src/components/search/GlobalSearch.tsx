"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { BotIcon, ListTodoIcon, SearchIcon, SearchXIcon, type LucideIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { TASK_STAGES, type TaskStatus } from "@/components/tasks/task-model";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { SearchResult, SearchResultType } from "@/lib/schemas/search";
import { cn } from "@/lib/utils";
import { groupResults, matchesQuickAction, searchGroupLabels, splitHighlight } from "./search-model";
import { useGlobalSearch } from "./useGlobalSearch";
import { useQuickActions } from "./useQuickActions";

const RESULT_ICONS: Record<SearchResultType, LucideIcon> = {
  task: ListTodoIcon,
  agent: BotIcon,
};

type BadgeVariant = "secondary" | "info" | "warning" | "success";

// DESIGN.md status mapping: neutral → secondary, in progress → info, waiting on a decision → warning, approved → success.
const STAGE_BADGE: Record<(typeof TASK_STAGES)[number]["value"], BadgeVariant> = {
  proposed: "secondary",
  open: "secondary",
  in_progress: "info",
  in_review: "warning",
  approved: "success",
};

function taskStatusBadge(status: string): { label: string; variant: BadgeVariant } | null {
  if (status === "changes_requested") return { label: "Changes requested", variant: "warning" };
  const stage = TASK_STAGES.find((option) => option.statuses.includes(status as TaskStatus));
  return stage ? { label: stage.label, variant: STAGE_BADGE[stage.value] } : null;
}

// Group headings use the app's small uppercase label style.
const GROUP =
  "p-0 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:text-2xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:tracking-[0.07em] **:[[cmdk-group-heading]]:uppercase";

// cmdk's item appends a check mark for checkable menus; search results never check, so hide it.
const ITEM = "min-h-12 gap-3 rounded-xl! px-3 py-2 data-selected:bg-accent [&>svg:last-child]:hidden";

function ItemIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-deep">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  return (
    <span className="truncate font-medium text-foreground">
      {splitHighlight(title, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-transparent font-bold text-primary-deep">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

function ResultItem({ result, query, onSelect }: { result: SearchResult; query: string; onSelect: () => void }) {
  const badge = result.type === "task" && result.status ? taskStatusBadge(result.status) : null;
  const where = result.matchedField === "description" ? "Matched in the description" : null;

  return (
    <CommandItem value={`${result.type}-${result.id}`} onSelect={onSelect} className={ITEM}>
      <ItemIcon icon={RESULT_ICONS[result.type]} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <HighlightedTitle title={result.title} query={query} />
        {(result.subtitle || where) && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {result.subtitle && (
              <span className={cn("truncate", result.type === "task" && "shrink-0 font-mono")}>{result.subtitle}</span>
            )}
            {result.subtitle && where && <span aria-hidden="true">·</span>}
            {where && <span className="truncate">{where}</span>}
          </span>
        )}
      </span>
      {badge && (
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      )}
    </CommandItem>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-card px-1 font-sans text-[11px] font-semibold text-muted-foreground">
      {children}
    </kbd>
  );
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. Starts empty so the server render and first client render match. */
function useShortcutLabel() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K");
  }, []);
  return label;
}

/** Project-wide search for tasks and agents, opened from the top bar or with ⌘K / Ctrl+K. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { href } = useProject();
  const shortcut = useShortcutLabel();
  const { actions, dialogs } = useQuickActions();
  const { query, setQuery, status, results, stale, retry, normalizedQuery } = useGlobalSearch(open);
  const groups = useMemo(() => groupResults(results), [results]);
  const matchingActions = actions.filter((action) => matchesQuickAction(action.label, query));

  const length = query.trim().length;
  const idle = length < 2;
  const tooLong = length > 100;
  const firstLoad = status === "loading" && results.length === 0;
  const nothingFound = status === "success" && !stale && results.length === 0 && !idle && !tooLong;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(href(path));
  };

  const announcement =
    status === "loading"
      ? "Searching"
      : status === "error"
        ? "Search failed"
        : status === "success" && !idle
          ? `${results.length} ${results.length === 1 ? "result" : "results"}`
          : "";

  return (
    <>
      <Button variant="outline" size="icon" aria-label="Search this project" onClick={() => setOpen(true)} className="md:hidden">
        <SearchIcon aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden h-10 w-56 shrink-0 items-center gap-2.5 rounded-full border border-border bg-card pr-2 pl-4 text-sm text-muted-foreground transition-[border-color,box-shadow] outline-none hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 md:flex lg:w-64"
      >
        <SearchIcon className="size-4.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Search tasks and agents</span>
        {shortcut && (
          <kbd className="rounded-full bg-muted px-2 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground">
            {shortcut}
          </kbd>
        )}
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search this project"
        description="Find tasks and agents in this project, or start a quick action."
        className="top-[12dvh] w-[calc(100vw-1.5rem)] max-w-xl rounded-3xl! sm:max-w-xl"
      >
        <Command shouldFilter={false} className="rounded-3xl! p-0">
          <div className="flex h-14 items-center gap-3 border-b border-border px-5">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search tasks and agents, or paste a ref like T-412"
              aria-label="Search this project"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {status === "loading" && <Spinner className="size-4 shrink-0 text-muted-foreground" />}
          </div>
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>

          <CommandList className="max-h-[min(56dvh,26rem)] scroll-py-2 p-2">
            {status === "error" && (
              <Alert variant="destructive" className="mb-2">
                <AlertDescription>Search failed. Check your connection and try again.</AlertDescription>
                <AlertAction>
                  <Button size="sm" variant="outline" onClick={retry}>
                    Try again
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {tooLong && <p className="m-0 px-3 py-2 text-sm text-muted-foreground">Search is limited to 100 characters.</p>}

            {firstLoad && (
              <div aria-hidden="true" className="flex flex-col gap-1 p-1">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {nothingFound && (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary-deep">
                  <SearchXIcon className="size-5" aria-hidden="true" />
                </span>
                <p className="m-0 text-[15px] font-bold text-foreground">Nothing matches “{query.trim()}”</p>
                <p className="m-0 max-w-xs text-sm text-muted-foreground">
                  Try part of a task title, an agent&apos;s name or speciality, or a ref like T-412.
                </p>
              </div>
            )}

            <div className={cn("transition-opacity duration-150", stale && "opacity-55")}>
              {groups.map((group) => (
                <CommandGroup key={group.type} heading={searchGroupLabels[group.type]} className={cn(GROUP, "pb-1")}>
                  {group.results.map((result) => (
                    <ResultItem
                      key={`${result.type}-${result.id}`}
                      result={result}
                      query={normalizedQuery}
                      onSelect={() => go(result.href)}
                    />
                  ))}
                </CommandGroup>
              ))}
            </div>

            {matchingActions.length > 0 && (
              <CommandGroup heading="Quick actions" className={GROUP}>
                {matchingActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={`action-${action.id}`}
                    onSelect={() => {
                      setOpen(false);
                      action.run();
                    }}
                    className={ITEM}
                  >
                    <ItemIcon icon={action.icon} />
                    <span className="font-medium text-foreground">{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {idle && (
              <p className="m-0 px-3 pt-3 pb-1 text-[13px] text-muted-foreground">
                Type two or more letters to search task titles and descriptions, agent names and specialities.
              </p>
            )}
          </CommandList>

          <div className="hidden items-center gap-4 border-t border-border px-5 py-2.5 text-xs text-muted-foreground pointer-fine:flex">
            <span className="flex items-center gap-1.5">
              <Key>↑</Key>
              <Key>↓</Key>
              to move
            </span>
            <span className="flex items-center gap-1.5">
              <Key>↵</Key>
              to open
            </span>
            <span className="flex items-center gap-1.5">
              <Key>esc</Key>
              to close
            </span>
          </div>
        </Command>
      </CommandDialog>
      {dialogs}
    </>
  );
}
