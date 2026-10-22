import {
  parseTaskBoardQuery,
  type TaskBoardQuery,
} from "@/lib/schemas/task-board";

/** Parse a browser search string without discarding duplicate recognized keys. */
export function parseTaskBoardSearch(search: string) {
  return parseTaskBoardQuery(new URLSearchParams(search));
}

/** Serialize committed filters into their canonical shareable form. */
export function serializeTaskBoardQuery(query: TaskBoardQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "open_for_bids") params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  if (query.goal) params.set("goal", query.goal);
  if (query.agent) params.set("agent", query.agent);
  if (query.minPoints !== undefined) params.set("minPoints", String(query.minPoints));
  if (query.maxPoints !== undefined) params.set("maxPoints", String(query.maxPoints));
  if (query.page !== 1) params.set("page", String(query.page));
  return params.toString();
}

/** Apply a filter change to the latest committed state and return to page one. */
export function applyTaskBoardFilterChange(
  current: TaskBoardQuery,
  patch: Partial<Omit<TaskBoardQuery, "page">>
): TaskBoardQuery {
  return { ...current, ...patch, page: 1 };
}

export function buildTaskBoardShareUrl(pathname: string, origin: string, query: TaskBoardQuery): string {
  const url = new URL(pathname, origin);
  const canonical = serializeTaskBoardQuery(query);
  if (canonical) url.search = canonical;
  return url.toString();
}

export function taskBoardFieldErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  return error.flatten().fieldErrors as Partial<Record<keyof TaskBoardQuery, string[]>>;
}
