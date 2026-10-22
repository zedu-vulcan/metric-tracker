"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BotIcon,
  FileTextIcon,
  FolderSearchIcon,
  ListTodoIcon,
  NewspaperIcon,
  SearchIcon,
  SendIcon,
  TargetIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResult, SearchResultType } from "@/lib/schemas/search";
import { groupResults, matchesQuickAction, searchGroupLabels, splitHighlight } from "./search-model";
import { useGlobalSearch } from "./useGlobalSearch";
import { useQuickActions } from "./useQuickActions";

const resultIcons: Record<SearchResultType, LucideIcon> = {
  goal: TargetIcon,
  workstream: FolderSearchIcon,
  task: ListTodoIcon,
  agent: BotIcon,
  directory: FolderSearchIcon,
  content: FileTextIcon,
  press_outlet: NewspaperIcon,
  press_coverage: NewspaperIcon,
  press_submission: SendIcon,
};

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  return (
    <span className="truncate">
      {splitHighlight(title, query).map((part, index) =>
        part.match ? (
          <span className="font-semibold text-primary-deep" key={`${index}-${part.text}`}>
            {part.text}
          </span>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function ResultItem({ result, query, onSelect }: {
  result: SearchResult;
  query: string;
  onSelect: () => void;
}) {
  const Icon = resultIcons[result.type];
  return (
    <CommandItem
      value={`${result.type}-${result.id}-${result.title}`}
      onSelect={onSelect}
      className="min-h-11 gap-3 px-3 py-2"
    >
      <Icon aria-hidden="true" className="text-muted-foreground" />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <HighlightedTitle title={result.title} query={query} />
          {result.subtitle && <span className="truncate text-xs text-muted-foreground">{result.subtitle}</span>}
        </span>
        {result.status && <span className="shrink-0 text-xs text-muted-foreground">{result.status}</span>}
      </span>
    </CommandItem>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { href } = useProject();
  const { actions, dialogs } = useQuickActions();
  const { query, setQuery, status, results, retry, normalizedQuery } = useGlobalSearch(open);
  const groups = useMemo(() => groupResults(results), [results]);
  const matchingActions = actions.filter((action) => matchesQuickAction(action.label, query));
  const trimmedQuery = query.trim();
  const queryLength = trimmedQuery.length;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectResult = (result: SearchResult) => {
    close();
    router.push(href(result.href));
  };

  const resultAnnouncement = status === "loading"
    ? "Searching"
    : status === "error"
      ? "Search failed"
      : status === "success"
        ? `${results.length} ${results.length === 1 ? "result" : "results"}`
        : "";

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Search this project"
        onClick={() => setOpen(true)}
        className="sm:hidden"
      >
        <SearchIcon aria-hidden="true" />
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <SearchIcon data-icon="inline-start" aria-hidden="true" />
        Search
        <kbd className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">⌘K</kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search this project"
        description="Find goals, workstreams, tasks, agents and marketing records."
        className="top-1/2 w-[calc(100vw-1rem)] max-w-2xl -translate-y-1/2 p-0"
      >
        <Command shouldFilter={false} className="rounded-xl p-0">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search goals, tasks, agents…"
            aria-label="Search this project"
          />
          <div aria-live="polite" className="sr-only">{resultAnnouncement}</div>
          <CommandList className="max-h-[min(60vh,32rem)] scroll-py-1 px-1 pb-2">
            {queryLength < 2 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            )}
            {queryLength > 100 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Search is limited to 100 characters.
              </p>
            )}
            {status === "loading" && (
              <div aria-label="Loading search results" className="grid gap-1 p-2">
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
              </div>
            )}
            {status === "error" && (
              <Alert variant="destructive" className="m-2 w-auto">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>Search failed. Check your connection and try again.</span>
                  <Button size="sm" variant="outline" onClick={retry}>Retry</Button>
                </AlertDescription>
              </Alert>
            )}
            {status === "success" && results.length === 0 && queryLength >= 2 && queryLength <= 100 && (
              <Empty className="min-h-40 border-0 p-6">
                <EmptyHeader>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>Try another name or a different search term.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {groups.map((group) => (
              <CommandGroup key={group.type} heading={searchGroupLabels[group.type]}>
                {group.results.map((result) => (
                  <ResultItem
                    key={`${result.type}-${result.id}`}
                    result={result}
                    query={normalizedQuery}
                    onSelect={() => selectResult(result)}
                  />
                ))}
              </CommandGroup>
            ))}
            {matchingActions.length > 0 && (
              <CommandGroup heading="Quick actions">
                {matchingActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={action.id}
                      value={`action-${action.id}-${action.label}`}
                      onSelect={() => {
                        close();
                        action.run();
                      }}
                      className="min-h-11 gap-3 px-3 py-2"
                    >
                      <Icon aria-hidden="true" className="text-muted-foreground" />
                      <span>{action.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
      {dialogs}
    </>
  );
}
