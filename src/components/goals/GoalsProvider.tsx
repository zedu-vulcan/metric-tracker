"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/request-json";
import {
  type Agent,
  type Bid,
  type DemoUser,
  type Goal,
  type GoalCounts,
  type GoalType,
  type Idea,
  type Task,
  type TaskStatus,
} from "./goal-model";
import type { CommentType, ThreadComment } from "./thread-model";

export type NewGoal = { title: string; type: GoalType; description: string };

/** A goal as `/api/goals` returns it. */
type ApiGoal = {
  id: string;
  title: string;
  description: string | null;
  type: GoalType;
  status: "active" | "completed" | "archived";
  createdById: string;
  createdBy?: { id: string; name: string | null; email: string | null };
  /** Only the list returns these. */
  ideaCounts?: { proposed: number; accepted: number; rejected: number };
  taskCounts?: { total: number; approved: number };
  createdAt: string;
};

const NO_COUNTS: GoalCounts = { pendingIdeas: 0, workstreams: 0, totalTasks: 0, approvedTasks: 0 };

function toGoal(goal: ApiGoal): Goal {
  return {
    id: goal.id,
    title: goal.title,
    type: goal.type,
    description: goal.description ?? "",
    ownerId: goal.createdById,
    ownerName: goal.createdBy?.name ?? goal.createdBy?.email ?? "A teammate",
    createdAt: goal.createdAt,
    counts: goal.ideaCounts
      ? {
          pendingIdeas: goal.ideaCounts.proposed,
          workstreams: goal.ideaCounts.accepted,
          totalTasks: goal.taskCounts?.total ?? 0,
          approvedTasks: goal.taskCounts?.approved ?? 0,
        }
      : NO_COUNTS,
  };
}

/** An agent as the goal, workstream and comment routes embed it. */
type ApiAgentRef = {
  id: string;
  name: string;
  speciality: string;
  lastActiveAt: string | null;
  /** The goal detail nests the owner; the other routes flatten it to `ownerName`. */
  owner?: { name: string | null };
  ownerName?: string | null;
};

function toAgent(agent: ApiAgentRef, fallbackActiveAt: string): Agent {
  return {
    id: agent.id,
    name: agent.name,
    speciality: agent.speciality,
    ownerName: agent.ownerName ?? agent.owner?.name ?? "A teammate",
    lastActiveAt: agent.lastActiveAt ?? fallbackActiveAt,
  };
}

/** An idea (a workstream record) as `/api/goals/{id}` and the idea routes return it. */
type ApiIdea = {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  status: Idea["status"];
  proposedByAgentId: string | null;
  proposedByAgent?: ApiAgentRef | null;
  acceptedBy?: { name: string | null; email: string | null } | null;
  rejectionReason?: string | null;
  upvotes?: { id: string; agent: ApiAgentRef; reason: string; createdAt: string }[];
  /** Only the goal detail includes these. */
  tasks?: { status: TaskStatus }[];
  createdAt: string;
  updatedAt: string;
};

type ApiGoalDetail = { acceptedWorkstreams: ApiIdea[]; pendingIdeas: ApiIdea[]; rejectedIdeas?: ApiIdea[] };

function toIdea(idea: ApiIdea): Idea {
  return {
    id: idea.id,
    goalId: idea.goalId,
    agentId: idea.proposedByAgentId ?? "",
    title: idea.title,
    description: idea.description ?? "",
    proposedAt: idea.createdAt,
    status: idea.status,
    decidedBy: idea.acceptedBy ? (idea.acceptedBy.name ?? idea.acceptedBy.email ?? undefined) : undefined,
    // There's no decision timestamp yet; the record's last update is when it was decided.
    decidedAt: idea.status === "proposed" ? undefined : idea.updatedAt,
    rejectionReason: idea.rejectionReason ?? undefined,
    upvotes: (idea.upvotes ?? []).map((upvote) => ({
      id: upvote.id,
      agentId: upvote.agent.id,
      reason: upvote.reason,
      at: upvote.createdAt,
    })),
    taskStatuses: idea.tasks?.map((task) => task.status) ?? [],
  };
}

/** A task as `/api/workstreams/{id}` returns it, with the board numbers merged in. */
type ApiTask = {
  id: string;
  workstreamId: string | null;
  taskType: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedAgentId: string | null;
  offeredToAgentId: string | null;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  revisionCount: number;
  maxRevisions: number;
  points?: number | null;
  bidCount?: number;
  commentCount?: number;
  reviewsThisRound?: number;
  assignedAgent?: ApiAgentRef | null;
  offeredToAgent?: ApiAgentRef | null;
  createdAt: string;
  updatedAt: string;
};

type ApiWorkstreamDetail = { id: string; tasks: ApiTask[] };

function toTask(task: ApiTask, workstreamId: string): Task {
  const offerLive =
    task.offeredToAgentId && task.offerExpiresAt && Date.parse(task.offerExpiresAt) > Date.now()
      ? { agentId: task.offeredToAgentId, sentAt: task.offeredAt ?? task.updatedAt, expiresAt: task.offerExpiresAt }
      : undefined;
  return {
    id: task.id,
    workstreamId,
    title: task.title,
    description: task.description ?? "",
    taskType: task.taskType,
    points: task.points ?? null,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedAgentId: task.assignedAgentId ?? undefined,
    bidCount: task.bidCount ?? 0,
    offer: offerLive,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    reviewCount: task.reviewsThisRound ?? 0,
    commentCount: task.commentCount ?? 0,
  };
}

/** A comment as `/api/tasks/{id}/comments` returns it. */
type ApiComment = {
  id: string;
  taskId: string;
  type: CommentType;
  title: string | null;
  body: string;
  attachment: string | null;
  score: number | null;
  verdict: "approve" | "changes" | null;
  parentId: string | null;
  authorAgentId: string | null;
  authorAgent: ApiAgentRef | null;
  authorUser: { name: string | null; email: string | null } | null;
  createdAt: string;
};

const ATTACHMENT_LABELS: Partial<Record<CommentType, string>> = { delivery: "Delivered work" };

function toComment(comment: ApiComment): ThreadComment {
  const attachment = comment.attachment?.trim();
  const isLink = attachment ? /^https?:\/\/\S+$/.test(attachment) : false;
  return {
    id: comment.id,
    taskId: comment.taskId,
    type: comment.type,
    title: comment.title ?? "",
    body: comment.body,
    author: comment.authorAgentId
      ? { kind: "agent", agentId: comment.authorAgentId }
      : { kind: "human", name: comment.authorUser?.name ?? comment.authorUser?.email ?? "A teammate" },
    at: comment.createdAt,
    attachment: attachment
      ? { kind: isLink ? "link" : "text", label: isLink ? "Link" : (ATTACHMENT_LABELS[comment.type] ?? "Attachment"), content: attachment }
      : undefined,
    score: comment.score ?? undefined,
    verdict: comment.verdict ?? undefined,
    parentId: comment.parentId ?? undefined,
  };
}

/** Marks a record as loading unless it's already on screen; a background refresh keeps showing it. */
function markLoading(previous: Record<string, LoadStatus>, id: string) {
  return previous[id] === "ready" ? previous : { ...previous, [id]: "loading" as const };
}

/** A failed refresh keeps what's on screen; only a first load turns into an error. */
function markFailed(previous: Record<string, LoadStatus>, id: string) {
  return previous[id] === "ready" ? previous : { ...previous, [id]: "error" as const };
}

export type LoadStatus = "loading" | "ready" | "error";

type GoalsContextValue = {
  currentUser: DemoUser;
  goals: Goal[];
  /** True until the first `/api/goals` response arrives. */
  goalsLoading: boolean;
  goalsError: boolean;
  reloadGoals: () => void;
  /** Ideas of the goals loaded with `loadIdeas`. Accepted ideas are workstreams. */
  ideas: Idea[];
  ideasStatus: (goalId: string) => LoadStatus | undefined;
  /** Loads (or refreshes) one goal's ideas and workstreams. */
  loadIdeas: (goalId: string) => void;
  /** Tasks of the workstreams loaded with `loadWorkstream`. */
  tasks: Task[];
  tasksStatus: (workstreamId: string) => LoadStatus | undefined;
  loadWorkstream: (workstreamId: string) => void;
  threadFor: (taskId: string) => ThreadComment[];
  threadStatus: (taskId: string) => LoadStatus | undefined;
  loadThread: (taskId: string) => void;
  bidsFor: (taskId: string) => Bid[];
  agentFor: (agentId: string) => Agent | undefined;
  createGoal: (input: NewGoal) => Promise<Goal>;
  deleteGoal: (goalId: string) => Promise<void>;
  approveIdea: (ideaId: string) => Promise<void>;
  rejectIdea: (ideaId: string, reason: string) => Promise<void>;
  sendOffer: (taskId: string, agentId: string) => Promise<void>;
  withdrawOffer: (taskId: string) => Promise<void>;
  /** Posts a note from the signed-in person to the task's thread. */
  postNote: (taskId: string, body: string, parentId?: string) => Promise<void>;
};

const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);

const EMPTY_THREAD: ThreadComment[] = [];

/** Store for the Goals section, mounted by the dashboard layout so the top bar can create goals. */
export function GoalsProvider({ currentUser, children }: { currentUser: DemoUser; children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaStatuses, setIdeaStatuses] = useState<Record<string, LoadStatus>>({});
  const [tasksByWorkstream, setTasksByWorkstream] = useState<Record<string, Task[]>>({});
  const [taskStatuses, setTaskStatuses] = useState<Record<string, LoadStatus>>({});
  const [threads, setThreads] = useState<Record<string, ThreadComment[]>>({});
  const [threadStatuses, setThreadStatuses] = useState<Record<string, LoadStatus>>({});
  /** Agents seen on ideas, tasks and comments, so cards can show who did what. */
  const [apiAgents, setApiAgents] = useState<Record<string, Agent>>({});

  const tasks = useMemo(() => Object.values(tasksByWorkstream).flat(), [tasksByWorkstream]);

  const reloadGoals = useCallback(() => {
    requestJson<ApiGoal[]>("/api/goals")
      .then((next) => {
        setGoals(next.filter((goal) => goal.status !== "archived").map(toGoal));
        setGoalsError(false);
      })
      .catch(() => setGoalsError(true))
      .finally(() => setGoalsLoading(false));
  }, []);

  // Refetching on focus picks up goals teammates created in the meantime.
  useEffect(() => {
    reloadGoals();
    window.addEventListener("focus", reloadGoals);
    return () => window.removeEventListener("focus", reloadGoals);
  }, [reloadGoals]);

  const createGoal = useCallback(async (input: NewGoal) => {
    const goal = toGoal(
      await requestJson<ApiGoal>("/api/goals", {
        method: "POST",
        body: JSON.stringify({ title: input.title, type: input.type, description: input.description || null }),
      })
    );
    setGoals((previous) => [goal, ...previous.filter((candidate) => candidate.id !== goal.id)]);
    return goal;
  }, []);

  const deleteGoal = useCallback(async (goalId: string) => {
    await requestJson(`/api/goals/${goalId}`, { method: "DELETE" });
    setGoals((previous) => previous.filter((goal) => goal.id !== goalId));
  }, []);

  const rememberAgents = useCallback((refs: (ApiAgentRef | null | undefined)[], fallbackActiveAt: string) => {
    const seen = refs.flatMap((ref) => (ref ? [toAgent(ref, fallbackActiveAt)] : []));
    if (seen.length > 0) setApiAgents((previous) => ({ ...previous, ...Object.fromEntries(seen.map((agent) => [agent.id, agent])) }));
  }, []);

  const loadIdeas = useCallback(
    (goalId: string) => {
      setIdeaStatuses((previous) => markLoading(previous, goalId));
      requestJson<ApiGoalDetail>(`/api/goals/${goalId}`)
        .then((detail) => {
          const records = [...detail.acceptedWorkstreams, ...detail.pendingIdeas, ...(detail.rejectedIdeas ?? [])];
          records.forEach((record) =>
            rememberAgents([record.proposedByAgent, ...(record.upvotes ?? []).map((upvote) => upvote.agent)], record.createdAt)
          );
          setIdeas((previous) => [...previous.filter((idea) => idea.goalId !== goalId), ...records.map(toIdea)]);
          setIdeaStatuses((previous) => ({ ...previous, [goalId]: "ready" }));
        })
        .catch(() => setIdeaStatuses((previous) => markFailed(previous, goalId)));
    },
    [rememberAgents]
  );

  const loadWorkstream = useCallback(
    (workstreamId: string) => {
      setTaskStatuses((previous) => markLoading(previous, workstreamId));
      requestJson<ApiWorkstreamDetail>(`/api/workstreams/${workstreamId}`)
        .then((detail) => {
          const now = new Date().toISOString();
          rememberAgents(detail.tasks.flatMap((task) => [task.assignedAgent, task.offeredToAgent]), now);
          setTasksByWorkstream((previous) => ({ ...previous, [workstreamId]: detail.tasks.map((task) => toTask(task, workstreamId)) }));
          setTaskStatuses((previous) => ({ ...previous, [workstreamId]: "ready" }));
        })
        .catch(() => setTaskStatuses((previous) => markFailed(previous, workstreamId)));
    },
    [rememberAgents]
  );

  const loadThread = useCallback(
    (taskId: string) => {
      setThreadStatuses((previous) => markLoading(previous, taskId));
      requestJson<ApiComment[]>(`/api/tasks/${taskId}/comments`)
        .then((comments) => {
          comments.forEach((comment) => rememberAgents([comment.authorAgent], comment.createdAt));
          setThreads((previous) => ({ ...previous, [taskId]: comments.map(toComment) }));
          setThreadStatuses((previous) => ({ ...previous, [taskId]: "ready" }));
        })
        .catch(() => setThreadStatuses((previous) => markFailed(previous, taskId)));
    },
    [rememberAgents]
  );

  // Agents post ideas, bids and deliveries at any time, so refresh what's open when the tab regains focus.
  useEffect(() => {
    const refresh = () => {
      const ready = (statuses: Record<string, LoadStatus>) =>
        Object.entries(statuses).flatMap(([id, status]) => (status === "ready" ? [id] : []));
      ready(ideaStatuses).forEach(loadIdeas);
      ready(taskStatuses).forEach(loadWorkstream);
      ready(threadStatuses).forEach(loadThread);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [ideaStatuses, taskStatuses, threadStatuses, loadIdeas, loadWorkstream, loadThread]);

  const decide = useCallback(
    async (ideaId: string, action: "accept" | "reject", reason?: string) => {
      const record = await requestJson<ApiIdea>(`/api/ideas/${ideaId}/${action}`, {
        method: "POST",
        body: action === "reject" ? JSON.stringify({ reason: reason || null }) : undefined,
      });
      rememberAgents([record.proposedByAgent], record.createdAt);
      // The idea routes don't include tasks; a newly accepted workstream has none yet.
      setIdeas((previous) =>
        previous.map((idea) => (idea.id === ideaId ? { ...toIdea(record), taskStatuses: idea.taskStatuses } : idea))
      );
      reloadGoals();
    },
    [rememberAgents, reloadGoals]
  );

  /** Sends or withdraws an offer, then reloads the task's workstream so the board shows the change. */
  const changeOffer = useCallback(
    async (taskId: string, method: "POST" | "DELETE", agentId?: string) => {
      await requestJson(`/api/tasks/${taskId}/offer`, {
        method,
        body: agentId ? JSON.stringify({ agentId }) : undefined,
      });
      const workstreamId = tasks.find((task) => task.id === taskId)?.workstreamId;
      if (workstreamId) loadWorkstream(workstreamId);
    },
    [tasks, loadWorkstream]
  );

  const postNote = useCallback(
    async (taskId: string, body: string, parentId?: string) => {
      await requestJson(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ type: "note", body, parentId }),
      });
      loadThread(taskId);
      const workstreamId = tasks.find((task) => task.id === taskId)?.workstreamId;
      if (workstreamId) loadWorkstream(workstreamId);
    },
    [tasks, loadThread, loadWorkstream]
  );

  const value = useMemo<GoalsContextValue>(
    () => ({
      currentUser,
      goals,
      goalsLoading,
      goalsError,
      reloadGoals,
      ideas,
      ideasStatus: (goalId) => ideaStatuses[goalId],
      loadIdeas,
      tasks,
      tasksStatus: (workstreamId) => taskStatuses[workstreamId],
      loadWorkstream,
      threadFor: (taskId) => threads[taskId] ?? EMPTY_THREAD,
      threadStatus: (taskId) => threadStatuses[taskId],
      loadThread,
      bidsFor: (taskId) =>
        (threads[taskId] ?? EMPTY_THREAD).flatMap((comment) =>
          comment.type === "bid" && comment.author.kind === "agent"
            ? [{ id: comment.id, taskId, agentId: comment.author.agentId, message: comment.body, createdAt: comment.at }]
            : []
        ),
      agentFor: (agentId) => apiAgents[agentId],
      createGoal,
      deleteGoal,
      approveIdea: (ideaId) => decide(ideaId, "accept"),
      rejectIdea: (ideaId, reason) => decide(ideaId, "reject", reason),
      sendOffer: (taskId, agentId) => changeOffer(taskId, "POST", agentId),
      withdrawOffer: (taskId) => changeOffer(taskId, "DELETE"),
      postNote,
    }),
    [
      currentUser,
      goals,
      goalsLoading,
      goalsError,
      reloadGoals,
      ideas,
      ideaStatuses,
      loadIdeas,
      tasks,
      taskStatuses,
      loadWorkstream,
      threads,
      threadStatuses,
      loadThread,
      apiAgents,
      createGoal,
      deleteGoal,
      decide,
      changeOffer,
      postNote,
    ]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalsContext);
  if (!context) throw new Error("useGoals must be used inside GoalsProvider");
  return context;
}
