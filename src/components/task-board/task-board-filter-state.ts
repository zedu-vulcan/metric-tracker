import { TASK_BOARD_MAX_POINTS, taskBoardQuerySchema, taskBoardStatusValues } from "@/lib/schemas/task-board";
import type { TaskBoardOptions, TaskBoardQuery } from "@/lib/schemas/task-board";

export type TaskBoardFilterPatch = Partial<Omit<TaskBoardQuery, "page">>;
export type TaskBoardFieldErrors = Partial<Record<keyof TaskBoardQuery, string[]>>;
export type TaskBoardFilterDrafts = { q: string; minPoints: string; maxPoints: string };
export type TaskBoardFilterChipKey = "q" | "status" | "type" | "goal" | "agent" | "points";
type Choice = { value: string; label: string };

export const taskBoardStatusLabels: Record<TaskBoardQuery["status"], string> = {
  open_for_bids: "Open for bids", all: "All statuses", proposed: "Proposed", open: "Open",
  bidding: "Bidding", reopened: "Reopened", in_progress: "In progress", submitted: "Submitted",
  in_review: "In review", changes_requested: "Changes requested", approved: "Approved",
};

export function getTaskBoardFilterDrafts(value: Pick<TaskBoardQuery, "q" | "minPoints" | "maxPoints">): TaskBoardFilterDrafts {
  return { q: value.q, minPoints: value.minPoints?.toString() ?? "", maxPoints: value.maxPoints?.toString() ?? "" };
}

/** Merge valid drafts with a discrete action atomically; no router or request side effects. */
export function getTaskBoardFilterChange(value: TaskBoardQuery, drafts: TaskBoardFilterDrafts, patch: TaskBoardFilterPatch = {}) {
  const nextDrafts = {
    q: "q" in patch ? patch.q ?? "" : drafts.q,
    minPoints: "minPoints" in patch ? patch.minPoints?.toString() ?? "" : drafts.minPoints,
    maxPoints: "maxPoints" in patch ? patch.maxPoints?.toString() ?? "" : drafts.maxPoints,
  };
  const parsed = taskBoardQuerySchema.safeParse({ ...value, ...patch, ...nextDrafts });
  if (!parsed.success) return parsed;
  const changes: TaskBoardFilterPatch = { ...patch };
  if (parsed.data.q !== value.q) changes.q = parsed.data.q;
  if (parsed.data.minPoints !== value.minPoints) changes.minPoints = parsed.data.minPoints;
  if (parsed.data.maxPoints !== value.maxPoints) changes.maxPoints = parsed.data.maxPoints;
  return { success: true as const, data: changes, drafts: getTaskBoardFilterDrafts(parsed.data) };
}

export function taskBoardDraftSignature(drafts: TaskBoardFilterDrafts) {
  return JSON.stringify(drafts);
}

export function getTaskBoardDraftFieldErrors(change: ReturnType<typeof getTaskBoardFilterChange>): TaskBoardFieldErrors {
  if (change.success) return {};
  const errors: TaskBoardFieldErrors = change.error.flatten().fieldErrors;
  const numberHint = `Use a whole number from 0 to ${TASK_BOARD_MAX_POINTS.toLocaleString("en-US")}, or leave this blank.`;
  if (errors.q?.length) errors.q = ["Search must be 200 characters or fewer."];
  if (errors.minPoints?.length) errors.minPoints = [numberHint];
  if (errors.maxPoints?.length && !change.error.issues.some((issue) => issue.code === "custom" && issue.path[0] === "maxPoints")) {
    errors.maxPoints = [numberHint];
  }
  return errors;
}

function retainSelection(choices: Choice[], value: string | undefined, loading: boolean): Choice[] {
  if (!value || choices.some((choice) => choice.value === value)) return choices;
  return [...choices, { value, label: `${loading ? "Loading selection" : "Unavailable"}: ${value}` }];
}

export function getTaskBoardFilterChoices(value: TaskBoardQuery, options: TaskBoardOptions, loading = false) {
  return {
    status: taskBoardStatusValues.map((status) => ({ value: status, label: taskBoardStatusLabels[status] })),
    type: retainSelection([
      { value: "", label: "Any type" },
      ...options.types.map((type) => ({ value: type.value, label: `${type.label}${type.isActive === false ? " (archived)" : type.isActive === null ? " (historical)" : ""}` })),
    ], value.type, loading),
    goal: retainSelection([
      { value: "", label: "Any goal" },
      ...options.goals.map((goal) => ({ value: goal.id, label: `${goal.title}${goal.status === "active" ? "" : ` (${goal.status})`}` })),
    ], value.goal, loading),
    agent: retainSelection([
      { value: "", label: "Any agent" }, { value: "unassigned", label: "Unassigned" }, { value: "mine", label: "My agents" },
      ...options.agents.map((agent) => ({ value: agent.id, label: `${agent.name} — ${agent.ownerName ?? "Owner name not set"}` })),
    ], value.agent, loading),
  };
}

export function getTaskBoardFilterChips(value: TaskBoardQuery, options: TaskBoardOptions) {
  const choices = getTaskBoardFilterChoices(value, options);
  const chips: { key: TaskBoardFilterChipKey; label: string }[] = [];
  if (value.q) chips.push({ key: "q", label: `Search: ${value.q}` });
  if (value.status !== "open_for_bids") chips.push({ key: "status", label: `Status: ${taskBoardStatusLabels[value.status]}` });
  for (const [key, label] of [["type", "Type"], ["goal", "Goal"], ["agent", "Assigned agent"]] as const) {
    if (value[key]) chips.push({ key, label: `${label}: ${choices[key].find((choice) => choice.value === value[key])?.label ?? value[key]}` });
  }
  if (value.minPoints !== undefined || value.maxPoints !== undefined) {
    const label = value.minPoints !== undefined && value.maxPoints !== undefined
      ? value.minPoints === value.maxPoints ? String(value.minPoints) : `${value.minPoints}–${value.maxPoints}`
      : value.minPoints !== undefined ? `at least ${value.minPoints}` : `up to ${value.maxPoints}`;
    chips.push({ key: "points", label: `Points: ${label}` });
  }
  return chips;
}

export function clearTaskBoardFilter(key: TaskBoardFilterChipKey): TaskBoardFilterPatch {
  if (key === "q") return { q: "" };
  if (key === "status") return { status: "open_for_bids" };
  if (key === "points") return { minPoints: undefined, maxPoints: undefined };
  return { [key]: undefined };
}
