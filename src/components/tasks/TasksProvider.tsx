"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AvatarStyle } from "@/components/agents/agent-model";
import { requestJson } from "@/lib/request-json";
import { type Agent, type Bid, type CurrentUser, type Task, type TaskStatus } from "./task-model";
import type { CommentType, ThreadComment } from "./thread-model";

export type NewTask = { title: string; description: string; taskType: string; points?: number };

/** An agent as the task and comment routes embed it. */
export type ApiAgentRef = {
  id: string;
  name: string;
  speciality: string;
  avatarStyle?: string;
  avatarSeed?: string;
  lastActiveAt: string | null;
  owner?: { id?: string; name: string | null };
  ownerId?: string | null;
  ownerName?: string | null;
};

export function toAgent(agent: ApiAgentRef, fallbackActiveAt: string): Agent {
  return {
    id: agent.id,
    name: agent.name,
    speciality: agent.speciality,
    avatar:
      agent.avatarStyle && agent.avatarSeed && agent.avatarSeed !== "default"
        ? { style: agent.avatarStyle as AvatarStyle, seed: agent.avatarSeed }
        : undefined,
    ownerId: agent.ownerId ?? agent.owner?.id ?? undefined,
    ownerName: agent.ownerName ?? agent.owner?.name ?? "A teammate",
    lastActiveAt: agent.lastActiveAt ?? fallbackActiveAt,
  };
}

/** A task as `/api/tasks` returns it. */
type ApiTask = {
  id: string;
  ref: string;
  taskType: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdById: string | null;
  createdBy: { name: string | null; email: string | null } | null;
  assignedAgentId: string | null;
  offeredToAgentId: string | null;
  offeredAt: string | null;
  offerExpiresAt: string | null;
  revisionCount: number;
  maxRevisions: number;
  points: number | null;
  upvotes: number;
  downvotes: number;
  bidCount: number;
  commentCount: number;
  reviewsThisRound: number;
  assignedAgent: ApiAgentRef | null;
  offeredToAgent: ApiAgentRef | null;
  createdAt: string;
  updatedAt: string;
};

function toTask(task: ApiTask): Task {
  const offerLive =
    task.offeredToAgentId && task.offerExpiresAt && Date.parse(task.offerExpiresAt) > Date.now()
      ? { agentId: task.offeredToAgentId, sentAt: task.offeredAt ?? task.updatedAt, expiresAt: task.offerExpiresAt }
      : undefined;
  return {
    id: task.id,
    ref: task.ref,
    title: task.title,
    description: task.description ?? "",
    taskType: task.taskType,
    points: task.points,
    status: task.status,
    createdById: task.createdById ?? undefined,
    createdByName: task.createdBy?.name ?? task.createdBy?.email ?? "A teammate",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignedAgentId: task.assignedAgentId ?? undefined,
    upvotes: task.upvotes,
    downvotes: task.downvotes,
    bidCount: task.bidCount,
    offer: offerLive,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    reviewCount: task.reviewsThisRound,
    commentCount: task.commentCount,
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

type TasksContextValue = {
  currentUser: CurrentUser;
  /** Every task in the project, newest first. */
  tasks: Task[];
  /** True until the first `/api/tasks` response arrives. */
  tasksLoading: boolean;
  tasksError: boolean;
  reloadTasks: () => void;
  /** Loads (or refreshes) one task, e.g. for a direct link or while its page is open. */
  loadTask: (taskId: string) => void;
  taskStatus: (taskId: string) => LoadStatus | undefined;
  threadFor: (taskId: string) => ThreadComment[];
  threadStatus: (taskId: string) => LoadStatus | undefined;
  loadThread: (taskId: string) => void;
  bidsFor: (taskId: string) => Bid[];
  agentFor: (agentId: string) => Agent | undefined;
  createTask: (input: NewTask) => Promise<Task>;
  sendOffer: (taskId: string, agentId: string) => Promise<void>;
  withdrawOffer: (taskId: string) => Promise<void>;
  /** Posts a note from the signed-in person to the task's thread. */
  postNote: (taskId: string, body: string, parentId?: string) => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

const EMPTY_THREAD: ThreadComment[] = [];

/** Store for the task board, mounted by the project layout so the top bar can post tasks. */
export function TasksProvider({ currentUser, children }: { currentUser: CurrentUser; children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, LoadStatus>>({});
  const [threads, setThreads] = useState<Record<string, ThreadComment[]>>({});
  const [threadStatuses, setThreadStatuses] = useState<Record<string, LoadStatus>>({});
  /** Agents seen on tasks and comments, so cards can show who did what. */
  const [apiAgents, setApiAgents] = useState<Record<string, Agent>>({});

  const rememberAgents = useCallback((refs: (ApiAgentRef | null | undefined)[], fallbackActiveAt: string) => {
    const seen = refs.flatMap((ref) => (ref ? [toAgent(ref, fallbackActiveAt)] : []));
    if (seen.length > 0) setApiAgents((previous) => ({ ...previous, ...Object.fromEntries(seen.map((agent) => [agent.id, agent])) }));
  }, []);

  const upsertTask = useCallback(
    (record: ApiTask) => {
      rememberAgents([record.assignedAgent, record.offeredToAgent], new Date().toISOString());
      const task = toTask(record);
      setTasks((previous) =>
        previous.some((candidate) => candidate.id === task.id)
          ? previous.map((candidate) => (candidate.id === task.id ? task : candidate))
          : [task, ...previous]
      );
      setTaskStatuses((previous) => ({ ...previous, [task.id]: "ready" }));
      return task;
    },
    [rememberAgents]
  );

  const reloadTasks = useCallback(() => {
    requestJson<ApiTask[]>("/api/tasks")
      .then((records) => {
        const now = new Date().toISOString();
        rememberAgents(records.flatMap((task) => [task.assignedAgent, task.offeredToAgent]), now);
        setTasks(records.map(toTask));
        setTaskStatuses((previous) => ({ ...previous, ...Object.fromEntries(records.map((task) => [task.id, "ready" as const])) }));
        setTasksError(false);
      })
      .catch(() => setTasksError(true))
      .finally(() => setTasksLoading(false));
  }, [rememberAgents]);

  const loadTask = useCallback(
    (taskId: string) => {
      setTaskStatuses((previous) => markLoading(previous, taskId));
      requestJson<ApiTask>(`/api/tasks/${taskId}`)
        .then(upsertTask)
        .catch(() => setTaskStatuses((previous) => markFailed(previous, taskId)));
    },
    [upsertTask]
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

  // Agents post tasks, bids and deliveries at any time, so refresh what's open when the tab regains focus.
  useEffect(() => {
    reloadTasks();
    const refresh = () => {
      reloadTasks();
      Object.entries(threadStatuses).forEach(([id, status]) => status === "ready" && loadThread(id));
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [reloadTasks, threadStatuses, loadThread]);

  const createTask = useCallback(
    async (input: NewTask) =>
      upsertTask(
        await requestJson<ApiTask>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ ...input, description: input.description || null }),
        })
      ),
    [upsertTask]
  );

  /** Sends or withdraws an offer, then reloads the task so the board shows the change. */
  const changeOffer = useCallback(
    async (taskId: string, method: "POST" | "DELETE", agentId?: string) => {
      await requestJson(`/api/tasks/${taskId}/offer`, {
        method,
        body: agentId ? JSON.stringify({ agentId }) : undefined,
      });
      loadTask(taskId);
    },
    [loadTask]
  );

  const postNote = useCallback(
    async (taskId: string, body: string, parentId?: string) => {
      await requestJson(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ type: "note", body, parentId }),
      });
      loadThread(taskId);
      loadTask(taskId);
    },
    [loadThread, loadTask]
  );

  const value = useMemo<TasksContextValue>(
    () => ({
      currentUser,
      tasks,
      tasksLoading,
      tasksError,
      reloadTasks,
      loadTask,
      taskStatus: (taskId) => taskStatuses[taskId],
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
      createTask,
      sendOffer: (taskId, agentId) => changeOffer(taskId, "POST", agentId),
      withdrawOffer: (taskId) => changeOffer(taskId, "DELETE"),
      postNote,
    }),
    [
      currentUser,
      tasks,
      tasksLoading,
      tasksError,
      reloadTasks,
      loadTask,
      taskStatuses,
      threads,
      threadStatuses,
      loadThread,
      apiAgents,
      createTask,
      changeOffer,
      postNote,
    ]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) throw new Error("useTasks must be used inside TasksProvider");
  return context;
}
