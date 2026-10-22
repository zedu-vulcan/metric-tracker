import { TASK_BOARD_PAGE_SIZE } from "@/lib/schemas/task-board";
import type { TaskBoardOptions, TaskBoardResponse, TaskBoardTask } from "@/lib/schemas/task-board";

export const TASK_BOARD_FIXTURE_NOW = "2026-10-22T09:00:00.000Z";

/** Fictional wire responses, not a replacement for a database query or availability calculation. */
export function createTaskBoardFixtures() {
  const goal = { id: "goal_demo", title: "Improve search visibility", status: "active" as const };
  const workstream = { id: "workstream_demo", title: "On-page SEO", status: "accepted" as const };
  const mine = { id: "agent_demo_mine", name: "Heading helper", ownerName: "Demo member" };
  const other = { id: "agent_demo_other", name: "Content helper", ownerName: "Another member" };
  function task(id: string, changes: Partial<TaskBoardTask> = {}): TaskBoardTask {
    return {
      id, projectId: "project_demo", title: "Improve homepage headings",
      description: "Review the heading structure.", status: "bidding",
      taskType: "seo", taskTypeLabel: "SEO", points: 25,
      goal: { ...goal }, workstream: { ...workstream },
      assignedAgentId: null, assignedAgent: null,
      offerPending: false, offerExpiresAt: null, isOpenForBids: true,
      detailsUrl: `/p/demo/goals/${goal.id}/workstreams/${workstream.id}/tasks/${id}`,
      createdAt: TASK_BOARD_FIXTURE_NOW, updatedAt: TASK_BOARD_FIXTURE_NOW,
      ...changes,
    };
  }
  const tasks = [
    task("task_demo_zero", { title: "A zero-point task", points: 0 }),
    task("task_demo_unknown", { title: "Points not configured", taskType: "historical", taskTypeLabel: "historical", points: null }),
    task("task_demo_fallback", { title: "Type points fallback", points: 25 }),
    task("task_demo_pending", { title: "Waiting for an offer reply", offerPending: true, offerExpiresAt: "2026-10-23T09:00:00.000Z", isOpenForBids: false }),
    task("task_demo_indefinite", { title: "Offer without an expiry", offerPending: true, isOpenForBids: false }),
    task("task_demo_expired", { title: "Offer expires exactly now", status: "reopened", offerExpiresAt: TASK_BOARD_FIXTURE_NOW }),
    task("task_demo_mine", { title: "My agent's assignment", status: "in_progress", assignedAgentId: mine.id, assignedAgent: { ...mine }, isOpenForBids: false }),
    task("task_demo_other", { title: "Another member's assignment", status: "submitted", assignedAgentId: other.id, assignedAgent: { ...other }, isOpenForBids: false }),
    task("task_demo_legacy", { title: "An older checklist task", status: "open", description: null, taskType: null, taskTypeLabel: "Not set", points: null, goal: null, workstream: null, detailsUrl: null, isOpenForBids: false }),
  ].sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  const options: TaskBoardOptions = {
    types: [
      { value: "historical", label: "historical", isActive: null },
      { value: "seo", label: "SEO", isActive: true },
    ],
    goals: [{ ...goal }],
    agents: [{ ...other, isMine: false }, { ...mine, isMine: true }],
  };
  const allStatusesResponse: TaskBoardResponse = {
    tasks,
    pagination: { page: 1, pageSize: TASK_BOARD_PAGE_SIZE, total: tasks.length, totalPages: 1 },
  };
  return {
    now: TASK_BOARD_FIXTURE_NOW, options, allStatusesResponse,
    // Input metadata for later service tests. The wire response only contains effective points.
    fallbackPointsSource: { taskId: "task_demo_fallback", storedPoints: null, activeTypePoints: 25 },
  };
}
