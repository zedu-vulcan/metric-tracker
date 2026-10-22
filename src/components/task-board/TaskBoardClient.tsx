"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CopyIcon, CheckIcon, AlertCircleIcon, RotateCcwIcon } from "lucide-react";
import { apiFetch } from "@/lib/request-json";
import {
  parseTaskBoardSearch,
  applyTaskBoardFilterChange,
  buildTaskBoardShareUrl,
  serializeTaskBoardQuery,
  taskBoardFieldErrors,
} from "@/lib/task-board-url";
import { taskBoardOptionsSchema, taskBoardResponseSchema } from "@/lib/schemas/task-board";
import type { TaskBoardOptions, TaskBoardQuery, TaskBoardResponse } from "@/lib/schemas/task-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProject } from "@/components/projects/ProjectProvider";
import { createTaskBoardShareController, type TaskBoardShareState } from "@/lib/task-board-share";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TaskBoardFilters } from "@/components/task-board/TaskBoardFilters";
import { TaskBoardResults } from "@/components/task-board/TaskBoardResults";

const DEFAULT_QUERY: TaskBoardQuery = { q: "", status: "open_for_bids", page: 1 };
const EMPTY_OPTIONS: TaskBoardOptions = { types: [], goals: [], agents: [] };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export function TaskBoardClient() {
  const { id: projectId } = useProject();
  return <TaskBoardProjectClient key={projectId} projectId={projectId} />;
}

function TaskBoardProjectClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const parsed = useMemo(() => parseTaskBoardSearch(search), [search]);
  const query = parsed.success ? parsed.data : null;
  const latestQueryRef = useRef(query);
  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);
  const [data, setData] = useState<TaskBoardResponse | null>(null);
  const [options, setOptions] = useState<TaskBoardOptions | null>(null);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [share, setShare] = useState<TaskBoardShareState>({ status: "idle", url: "" });
  const shareController = useMemo(() => createTaskBoardShareController({
    writeText: (url) => navigator.clipboard.writeText(url),
    onChange: setShare,
  }), []);

  useEffect(() => {
    shareController.reset();
    return () => shareController.dispose();
  }, [shareController, pathname, search]);
  const [resultsAttempt, setResultsAttempt] = useState(0);
  const [optionsAttempt, setOptionsAttempt] = useState(0);

  const apiQuery = query ? serializeTaskBoardQuery(query) : "";

  const navigate = useCallback((next: TaskBoardQuery, history: "push" | "replace") => {
    latestQueryRef.current = next;
    const serialized = serializeTaskBoardQuery(next);
    const url = serialized ? `${pathname}?${serialized}` : pathname;
    if (history === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }, [pathname, router]);

  const onChange = useCallback((patch: Partial<Omit<TaskBoardQuery, "page">>, history: "push" | "replace") => {
    const current = latestQueryRef.current;
    if (!current) return;
    navigate(applyTaskBoardFilterChange(current, patch), history);
  }, [navigate]);

  const onReset = useCallback(() => navigate(DEFAULT_QUERY, "push"), [navigate]);
  const onPageChange = useCallback((page: number) => {
    const current = latestQueryRef.current;
    if (current) navigate({ ...current, page }, "push");
  }, [navigate]);

  const loadOptions = useCallback(async (signal?: AbortSignal) => {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const response = await apiFetch("/api/tasks/board/options", { signal });
      if (signal?.aborted) return;
      const body: unknown = await response.json().catch(() => null);
      if (signal?.aborted) return;
      if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Unable to load filter options");
      const parsedBody = taskBoardOptionsSchema.safeParse(body);
      if (!parsedBody.success) throw new Error("The server returned invalid filter options");
      setOptions(parsedBody.data);
    } catch (error) {
      if (signal?.aborted) return;
      setOptionsError(errorMessage(error));
    } finally {
      if (!signal?.aborted) setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query) {
      setResultsLoading(false);
      setData(null);
      setResultsError(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setResultsLoading(true);
    setResultsError(null);
    const url = apiQuery ? `/api/tasks/board?${apiQuery}` : "/api/tasks/board";
    void (async () => {
      try {
        const response = await apiFetch(url, { signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Unable to load tasks");
        const parsedBody = taskBoardResponseSchema.safeParse(body);
        if (!parsedBody.success) throw new Error("The server returned invalid task results");
        if (active) setData(parsedBody.data);
      } catch (error) {
        if (active && !controller.signal.aborted) setResultsError(errorMessage(error));
      } finally {
        if (active && !controller.signal.aborted) setResultsLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [apiQuery, query, search, resultsAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions, optionsAttempt]);

  const copyView = async () => {
    const fullUrl = query
      ? buildTaskBoardShareUrl(pathname, window.location.origin, query)
      : new URL(pathname, window.location.origin).toString();
    await shareController.copy(fullUrl);
  };

  if (!parsed.success) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon data-slot="icon" />
        <AlertTitle>Invalid task board URL</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{Object.values(taskBoardFieldErrors(parsed.error)).flat().join(". ") || "Check the query parameters."}</span>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcwIcon data-icon="inline-start" /> Reset to the default board
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copyView}>
          {share.status === "copied" ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {share.status === "copied" ? "Copied" : "Share view"}
        </Button>
      </div>
      {share.status === "error" && (
        <div role="status" className="flex flex-col gap-1.5 text-xs text-destructive">
          <label htmlFor="task-board-share-url">Could not copy the link. Select it to copy manually.</label>
          <Input
            id="task-board-share-url"
            type="text"
            readOnly
            value={share.url}
            onFocus={(event) => event.currentTarget.select()}
            className="h-9 w-full rounded-lg border border-border bg-card px-3 font-mono text-foreground"
          />
          <Button variant="outline" size="sm" className="self-start" onClick={() => shareController.reset()}>
            Dismiss copy link
          </Button>
        </div>
      )}
      {share.status === "copied" && <span role="status" className="sr-only">View link copied.</span>}
      <TaskBoardFilters
        key={projectId}
        value={parsed.data}
        options={options ?? EMPTY_OPTIONS}
        optionsLoading={optionsLoading}
        optionsError={optionsError}
        fieldErrors={{}}
        onChange={onChange}
        onReset={onReset}
        onRetryOptions={() => setOptionsAttempt((attempt) => attempt + 1)}
      />
      <TaskBoardResults
        data={data}
        loading={resultsLoading}
        error={resultsError}
        hasFilters={Boolean(parsed.data.q || parsed.data.status !== "open_for_bids" || parsed.data.type || parsed.data.goal || parsed.data.agent || parsed.data.minPoints !== undefined || parsed.data.maxPoints !== undefined)}
        isProjectEmpty={parsed.data.status === "all" && !parsed.data.q && !parsed.data.type && !parsed.data.goal && !parsed.data.agent && parsed.data.minPoints === undefined && parsed.data.maxPoints === undefined}
        suggestAllStatuses={parsed.data.status === "open_for_bids" && Boolean(parsed.data.agent)}
        onShowAllStatuses={() => onChange({ status: "all" }, "push")}
        onPageChange={onPageChange}
        onRetry={() => { setResultsError(null); setResultsLoading(true); setResultsAttempt((attempt) => attempt + 1); }}
        onReset={onReset}
      />
    </div>
  );
}
