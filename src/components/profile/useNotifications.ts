"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useProject } from "@/components/projects/ProjectProvider";
import { requestJson } from "@/lib/request-json";
import type { Notification, NotificationList } from "@/lib/schemas/notifications";

type State = { projectId: string | null; notifications: Notification[]; loading: boolean; failed: boolean };

const INITIAL: State = { projectId: null, notifications: [], loading: true, failed: false };
const POLL_MS = 60_000;

// One shared snapshot for the top-bar inbox and the Inbox tab, so the badge and the list never drift apart.
let state = INITIAL;
let mounted = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(projectId: string, list: NotificationList) {
  state = { projectId, notifications: list.items, loading: false, failed: false };
  for (const listener of listeners) listener();
}

async function load(projectId: string) {
  try {
    apply(projectId, await requestJson<NotificationList>("/api/notifications"));
  } catch {
    state = { ...state, loading: false, failed: true };
    for (const listener of listeners) listener();
  }
}

async function markRead(projectId: string, ids?: string[]) {
  // Show it read straight away; the server's answer replaces this.
  const marked = new Set(ids);
  state = {
    ...state,
    notifications: state.notifications.map((note) => (!ids || marked.has(note.id) ? { ...note, read: true } : note)),
  };
  for (const listener of listeners) listener();
  try {
    apply(projectId, await requestJson<NotificationList>("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }));
  } catch {
    await load(projectId);
  }
}

export function useNotifications() {
  const { id: projectId } = useProject();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  const current = snapshot.projectId === projectId ? snapshot : { ...INITIAL, projectId };

  useEffect(() => {
    mounted += 1;
    if (state.projectId !== projectId) {
      state = { ...INITIAL, projectId };
      void load(projectId);
    }
    if (!timer) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible" && state.projectId) void load(state.projectId);
      }, POLL_MS);
    }
    const onFocus = () => {
      if (state.projectId) void load(state.projectId);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      mounted -= 1;
      if (mounted === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [projectId]);

  return {
    notifications: current.notifications,
    loading: current.loading,
    failed: current.failed,
    unreadCount: current.notifications.filter((note) => !note.read).length,
    // Counted whether or not it's been opened: an item leaves the list when it's dealt with, not when it's read.
    actionCount: current.notifications.filter((note) => note.needsAction).length,
    markRead: (id: string) => markRead(projectId, [id]),
    markAllRead: () => markRead(projectId),
    reload: () => load(projectId),
  };
}
