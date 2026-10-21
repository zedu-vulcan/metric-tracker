"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEMO_AGENTS,
  MAX_REVISIONS,
  OFFER_HOURS,
  demoGoals,
  demoIdeas,
  demoTasks,
  type Agent,
  type Bid,
  type DemoUser,
  type Goal,
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

export type NewGoal = { title: string; type: string; description: string };

type GoalsContextValue = {
  currentUser: DemoUser;
  goals: Goal[];
  ideas: Idea[];
  tasks: Task[];
  bidsFor: (taskId: string) => Bid[];
  agentFor: (agentId: string) => Agent | undefined;
  createGoal: (input: NewGoal) => Goal;
  approveIdea: (ideaId: string) => void;
  rejectIdea: (ideaId: string, reason: string) => void;
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

/** Demo-only store for the Goals section, mounted by the dashboard layout so the top bar can create goals. */
export function GoalsProvider({ currentUser, children }: { currentUser: DemoUser; children: React.ReactNode }) {
  const [goals, setGoals] = useState(() => demoGoals(currentUser));
  const [ideas, setIdeas] = useState(() => demoIdeas(currentUser));
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

  const createGoal = useCallback(
    (input: NewGoal) => {
      const goal: Goal = {
        ...input,
        id: `goal_${Date.now()}`,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      setGoals((previous) => [goal, ...previous]);
      return goal;
    },
    [currentUser]
  );

  const decide = useCallback(
    (ideaId: string, change: Pick<Idea, "status"> & Partial<Idea>) =>
      setIdeas((previous) =>
        previous.map((idea) =>
          idea.id === ideaId
            ? { ...idea, ...change, decidedBy: currentUser.name, decidedAt: new Date().toISOString() }
            : idea
        )
      ),
    [currentUser]
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
      ideas,
      tasks,
      bidsFor: (taskId) =>
        (threads[taskId] ?? EMPTY_THREAD).flatMap((entry) =>
          entry.kind === "comment" && entry.type === "bid" && entry.author.kind === "agent"
            ? [{ id: entry.id, taskId, agentId: entry.author.agentId, message: entry.body, createdAt: entry.at }]
            : []
        ),
      agentFor: (agentId) => DEMO_AGENTS.find((agent) => agent.id === agentId),
      createGoal,
      approveIdea: (ideaId) => decide(ideaId, { status: "accepted" }),
      rejectIdea: (ideaId, reason) => decide(ideaId, { status: "rejected", rejectionReason: reason || undefined }),
      sendOffer,
      withdrawOffer: (taskId) => endOffer(taskId, "withdrawn"),
      acceptOffer: (taskId) => endOffer(taskId, "accepted"),
      expireOffer: (taskId) => endOffer(taskId, "expired"),
      threadFor: (taskId) => threads[taskId] ?? EMPTY_THREAD,
      approveTask,
      requestChanges,
    }),
    [currentUser, goals, ideas, tasks, threads, createGoal, decide, sendOffer, endOffer, approveTask, requestChanges]
  );

  return <GoalsContext.Provider value={value}>{children}</GoalsContext.Provider>;
}

export function useGoals() {
  const context = useContext(GoalsContext);
  if (!context) throw new Error("useGoals must be used inside GoalsProvider");
  return context;
}
