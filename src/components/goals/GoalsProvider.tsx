"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/request-json";
import {
  DEMO_AGENTS,
  MAX_REVISIONS,
  OFFER_HOURS,
  demoTasks,
  type Agent,
  type Bid,
  type DemoUser,
  type Goal,
  type GoalCounts,
  type GoalType,
  type Idea,
  type Task,
} from "./goal-model";
import {
  currentRoundReviews,
  demoThread,
  tagForTask,
  threadStats,
  type CommentType,
  type ThreadEntry,
} from "./thread-model";

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

type ApiAgentRef = {
  id: string;
  name: string;
  speciality: string;
  lastActiveAt: string | null;
};

/** An idea (a workstream record) as `/api/goals/{id}` and the idea routes return it. */
type ApiIdea = {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  status: Idea["status"];
  proposedByAgentId: string | null;
  /** The goal detail nests the owner; the idea routes flatten it to `ownerName`. */
  proposedByAgent?: (ApiAgentRef & { owner?: { name: string | null }; ownerName?: string | null }) | null;
  acceptedBy?: { name: string | null; email: string | null } | null;
  rejectionReason?: string | null;
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
  };
}

function toAgent(idea: ApiIdea): Agent | undefined {
  const agent = idea.proposedByAgent;
  if (!agent) return undefined;
  return {
    id: agent.id,
    name: agent.name,
    speciality: agent.speciality,
    ownerName: agent.ownerName ?? agent.owner?.name ?? "A teammate",
    lastActiveAt: agent.lastActiveAt ?? idea.createdAt,
  };
}

export type IdeasStatus = "loading" | "ready" | "error";

type GoalsContextValue = {
  currentUser: DemoUser;
  goals: Goal[];
  /** True until the first `/api/goals` response arrives. */
  goalsLoading: boolean;
  goalsError: boolean;
  reloadGoals: () => void;
  /** Ideas of the goals loaded with `loadIdeas`. Accepted ideas are workstreams. */
  ideas: Idea[];
  ideasStatus: (goalId: string) => IdeasStatus | undefined;
  /** Loads (or refreshes) one goal's ideas and workstreams. */
  loadIdeas: (goalId: string) => void;
  tasks: Task[];
  bidsFor: (taskId: string) => Bid[];
  agentFor: (agentId: string) => Agent | undefined;
  createGoal: (input: NewGoal) => Promise<Goal>;
  approveIdea: (ideaId: string) => Promise<void>;
  rejectIdea: (ideaId: string, reason: string) => Promise<void>;
  sendOffer: (taskId: string, agentId: string) => void;
  withdrawOffer: (taskId: string) => void;
  /** Demo stand-ins for what an agent does through the API. */
  acceptOffer: (taskId: string) => void;
  expireOffer: (taskId: string) => void;
  threadFor: (taskId: string) => ThreadEntry[];
  approveTask: (taskId: string, note: string) => void;
  requestChanges: (taskId: string, feedback: string) => void;
};

const GoalsContext = createContext<GoalsContextValue | undefined>(undefined);

const EMPTY_THREAD: ThreadEntry[] = [];

/**
 * Store for the Goals section, mounted by the dashboard layout so the top bar can create goals.
 * Goals and ideas come from the API; tasks and threads are still demo data.
 */
export function GoalsProvider({ currentUser, children }: { currentUser: DemoUser; children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaStatuses, setIdeaStatuses] = useState<Record<string, IdeasStatus>>({});
  /** Agents seen on ideas, so cards can show who proposed what. */
  const [apiAgents, setApiAgents] = useState<Record<string, Agent>>({});
  const [baseTasks, setBaseTasks] = useState(demoTasks);
  const [threads, setThreads] = useState<Record<string, ThreadEntry[]>>(() =>
    Object.fromEntries(baseTasks.map((task) => [task.id, demoThread(task)]))
  );

  /** Counts shown on task rows come from the thread, so the two never disagree. */
  const tasks = useMemo(
    () =>
      baseTasks.map((task) => {
        const thread = threads[task.id] ?? EMPTY_THREAD;
        const stats = threadStats(thread);
        return {
          ...task,
          bidCount: stats.bids,
          commentCount: stats.comments,
          reviewCount: currentRoundReviews(thread).length,
        };
      }),
    [baseTasks, threads]
  );

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

  const rememberAgents = useCallback((records: ApiIdea[]) => {
    const seen = records.flatMap((record) => toAgent(record) ?? []);
    if (seen.length > 0) setApiAgents((previous) => ({ ...previous, ...Object.fromEntries(seen.map((agent) => [agent.id, agent])) }));
  }, []);

  const loadIdeas = useCallback(
    (goalId: string) => {
      setIdeaStatuses((previous) => (previous[goalId] === "ready" ? previous : { ...previous, [goalId]: "loading" }));
      requestJson<ApiGoalDetail>(`/api/goals/${goalId}`)
        .then((detail) => {
          const records = [...detail.acceptedWorkstreams, ...detail.pendingIdeas, ...(detail.rejectedIdeas ?? [])];
          rememberAgents(records);
          setIdeas((previous) => [...previous.filter((idea) => idea.goalId !== goalId), ...records.map(toIdea)]);
          setIdeaStatuses((previous) => ({ ...previous, [goalId]: "ready" }));
        })
        .catch(() =>
          // Keep what's on screen if a refresh fails; only a first load turns into an error.
          setIdeaStatuses((previous) => (previous[goalId] === "ready" ? previous : { ...previous, [goalId]: "error" }))
        );
    },
    [rememberAgents]
  );

  // Ideas arrive from agents at any time, so refresh the goals already open when the tab regains focus.
  useEffect(() => {
    const refresh = () =>
      Object.entries(ideaStatuses).forEach(([goalId, status]) => status === "ready" && loadIdeas(goalId));
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [ideaStatuses, loadIdeas]);

  const decide = useCallback(
    async (ideaId: string, action: "accept" | "reject", reason?: string) => {
      const record = await requestJson<ApiIdea>(`/api/ideas/${ideaId}/${action}`, {
        method: "POST",
        body: action === "reject" ? JSON.stringify({ reason: reason || null }) : undefined,
      });
      rememberAgents([record]);
      setIdeas((previous) => previous.map((idea) => (idea.id === ideaId ? toIdea(record) : idea)));
      reloadGoals();
    },
    [rememberAgents, reloadGoals]
  );

  const append = useCallback((taskId: string, entries: ThreadEntry[]) => {
    setThreads((previous) => ({ ...previous, [taskId]: [...(previous[taskId] ?? []), ...entries] }));
  }, []);

  const updateTask = useCallback((taskId: string, change: Partial<Task>) => {
    setBaseTasks((previous) =>
      previous.map((task) => (task.id === taskId ? { ...task, ...change, updatedAt: new Date().toISOString() } : task))
    );
  }, []);

  const humanComment = useCallback(
    (task: Task, type: CommentType, title: string, body: string): ThreadEntry => ({
      kind: "comment",
      id: `${task.id}_${Date.now()}_${type}`,
      taskId: task.id,
      type,
      tag: tagForTask(task),
      title,
      body,
      author: { kind: "human", name: currentUser.name },
      at: new Date().toISOString(),
    }),
    [currentUser]
  );

  const systemEvent = (taskId: string, text: string): ThreadEntry => ({
    kind: "event",
    id: `${taskId}_${Date.now()}_event`,
    taskId,
    text,
    at: new Date().toISOString(),
  });

  const approveTask = useCallback(
    (taskId: string, note: string) => {
      const task = baseTasks.find((candidate) => candidate.id === taskId);
      if (!task) return;
      const owner = DEMO_AGENTS.find((agent) => agent.id === task.assignedAgentId)?.ownerName ?? "the worker's owner";
      append(taskId, [
        humanComment(task, "approval", "Approved", note || `Meets the brief. Releasing ${task.points} points to ${owner}.`),
        systemEvent(taskId, `${task.points} pts released to ${owner}`),
      ]);
      updateTask(taskId, { status: "approved" });
    },
    [baseTasks, append, humanComment, updateTask]
  );

  const requestChanges = useCallback(
    (taskId: string, feedback: string) => {
      const task = baseTasks.find((candidate) => candidate.id === taskId);
      if (!task) return;
      const worker = DEMO_AGENTS.find((agent) => agent.id === task.assignedAgentId)?.name ?? "The worker";

      if (task.revisionCount >= MAX_REVISIONS) {
        append(taskId, [
          humanComment(task, "revision_request", "Revision limit reached", feedback),
          systemEvent(taskId, `${worker} was unassigned after ${MAX_REVISIONS} revisions. The task is open for bids again`),
        ]);
        updateTask(taskId, { status: "bidding", assignedAgentId: undefined, revisionCount: 0 });
        return;
      }

      const round = task.revisionCount + 1;
      append(taskId, [humanComment(task, "revision_request", `Revision ${round} of ${MAX_REVISIONS}`, feedback)]);
      updateTask(taskId, { status: "changes_requested", revisionCount: round });
    },
    [baseTasks, append, humanComment, updateTask]
  );

  const agentName = (agentId?: string) => DEMO_AGENTS.find((agent) => agent.id === agentId)?.name ?? "the agent";

  const sendOffer = useCallback(
    (taskId: string, agentId: string) => {
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + OFFER_HOURS * 60 * 60 * 1000);
      updateTask(taskId, { offer: { agentId, sentAt: sentAt.toISOString(), expiresAt: expiresAt.toISOString() } });
      append(taskId, [systemEvent(taskId, `Offered to ${agentName(agentId)}`)]);
    },
    [append, updateTask]
  );

  const endOffer = useCallback(
    (taskId: string, outcome: "accepted" | "withdrawn" | "expired") => {
      const offer = baseTasks.find((candidate) => candidate.id === taskId)?.offer;
      if (!offer) return;
      const name = agentName(offer.agentId);
      if (outcome === "accepted") {
        updateTask(taskId, { status: "in_progress", assignedAgentId: offer.agentId, offer: undefined });
        append(taskId, [systemEvent(taskId, `${name} accepted the offer and started work`)]);
        return;
      }
      updateTask(taskId, { offer: undefined });
      append(taskId, [
        systemEvent(
          taskId,
          outcome === "withdrawn" ? `Offer to ${name} withdrawn` : `Offer to ${name} expired. The task is open for bids again`
        ),
      ]);
    },
    [baseTasks, append, updateTask]
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
      bidsFor: (taskId) =>
        (threads[taskId] ?? EMPTY_THREAD).flatMap((entry) =>
          entry.kind === "comment" && entry.type === "bid" && entry.author.kind === "agent"
            ? [{ id: entry.id, taskId, agentId: entry.author.agentId, message: entry.body, createdAt: entry.at }]
            : []
        ),
      agentFor: (agentId) => apiAgents[agentId] ?? DEMO_AGENTS.find((agent) => agent.id === agentId),
      createGoal,
      approveIdea: (ideaId) => decide(ideaId, "accept"),
      rejectIdea: (ideaId, reason) => decide(ideaId, "reject", reason),
      sendOffer,
      withdrawOffer: (taskId) => endOffer(taskId, "withdrawn"),
      acceptOffer: (taskId) => endOffer(taskId, "accepted"),
      expireOffer: (taskId) => endOffer(taskId, "expired"),
      threadFor: (taskId) => threads[taskId] ?? EMPTY_THREAD,
      approveTask,
      requestChanges,
    }),
    [currentUser, goals, goalsLoading, goalsError, reloadGoals, ideas, ideaStatuses, loadIdeas, apiAgents, tasks, threads, createGoal, decide, sendOffer, endOffer, approveTask, requestChanges]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalsContext);
  if (!context) throw new Error("useGoals must be used inside GoalsProvider");
  return context;
}
