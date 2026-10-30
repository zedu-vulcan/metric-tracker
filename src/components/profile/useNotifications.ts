"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useProject } from "@/components/projects/ProjectProvider";
import { requestJson } from "@/lib/request-json";
import { createNotificationStore, INITIAL_NOTIFICATIONS } from "@/components/profile/notification-store";

const POLL_MS = 60_000;

// One shared snapshot for the top-bar inbox and the Inbox tab, so the badge and the list never drift apart.
const store = createNotificationStore(requestJson);
let mounted = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function useNotifications() {
  const { id: projectId } = useProject();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, () => INITIAL_NOTIFICATIONS);
  const current = snapshot.projectId === projectId ? snapshot : { ...INITIAL_NOTIFICATIONS, projectId };

  useEffect(() => {
    mounted += 1;
    if (store.snapshot().projectId !== projectId) {
      store.setProject(projectId);
      void store.load(projectId);
    }
    if (!timer) {
      timer = setInterval(() => {
        const active = store.snapshot().projectId;
        if (document.visibilityState === "visible" && active) void store.load(active);
      }, POLL_MS);
    }
    const onFocus = () => {
      const active = store.snapshot().projectId;
      if (active) void store.load(active);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      mounted -= 1;
      if (mounted === 0) {
        if (timer) clearInterval(timer);
        timer = null;
        store.setProject(null);
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
    markRead: (id: string) => store.markRead(projectId, [id]),
    markAllRead: () => store.markRead(projectId),
    reload: () => store.load(projectId),
  };
}
