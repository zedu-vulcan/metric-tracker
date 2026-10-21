"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/profile/profile-service";

type State = { notifications: Notification[]; loading: boolean };

const INITIAL: State = { notifications: [], loading: true };

// One shared snapshot for the bell and the Inbox tab, so the badge and the list never drift apart.
let state = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-reads notifications from the service and updates every mounted bell and Inbox. */
export async function refreshNotifications() {
  state = { notifications: await listNotifications(), loading: false };
  for (const listener of listeners) listener();
}

async function markRead(id: string) {
  await markNotificationRead(id);
  await refreshNotifications();
}

async function markAllRead() {
  await markAllNotificationsRead();
  await refreshNotifications();
}

export function useNotifications() {
  const { notifications, loading } = useSyncExternalStore(subscribe, () => state, () => INITIAL);

  useEffect(() => {
    if (started) return;
    started = true;
    void refreshNotifications();
  }, []);

  return {
    notifications,
    loading,
    unreadCount: notifications.filter((note) => !note.read).length,
    markRead,
    markAllRead,
  };
}
