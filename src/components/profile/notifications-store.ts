import type { Notification, NotificationList } from "@/lib/schemas/notifications";

type State = { projectId: string | null; notifications: Notification[]; loading: boolean; failed: boolean };
type RequestNotifications = (url: string, init?: RequestInit) => Promise<NotificationList>;

export const INITIAL_NOTIFICATIONS: State = { projectId: null, notifications: [], loading: true, failed: false };

/** Shared inbox state; only responses for the current project and request may update it. */
export function createNotificationsStore(request: RequestNotifications) {
  let state = INITIAL_NOTIFICATIONS;
  let revision = 0;
  const listeners = new Set<() => void>();

  function publish(next: State) {
    state = next;
    for (const listener of listeners) listener();
  }

  function isCurrent(projectId: string, requestRevision: number) {
    return state.projectId === projectId && revision === requestRevision;
  }

  async function load(projectId: string) {
    if (state.projectId !== projectId) return;
    const requestRevision = ++revision;
    try {
      const list = await request("/api/notifications", { headers: { "x-project-id": projectId } });
      if (isCurrent(projectId, requestRevision)) {
        publish({ projectId, notifications: list.items, loading: false, failed: false });
      }
    } catch {
      if (isCurrent(projectId, requestRevision)) publish({ ...state, loading: false, failed: true });
    }
  }

  async function markRead(projectId: string, ids?: string[]) {
    if (state.projectId !== projectId) return;
    const requestRevision = ++revision;
    const marked = new Set(ids);
    publish({
      ...state,
      notifications: state.notifications.map((note) => (!ids || marked.has(note.id) ? { ...note, read: true } : note)),
    });
    try {
      const list = await request("/api/notifications/read", {
        method: "POST",
        headers: { "x-project-id": projectId },
        body: JSON.stringify({ ids }),
      });
      if (isCurrent(projectId, requestRevision)) {
        publish({ projectId, notifications: list.items, loading: false, failed: false });
      }
    } catch {
      if (isCurrent(projectId, requestRevision)) await load(projectId);
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    activate(projectId: string) {
      if (state.projectId === projectId) return;
      // Invalidate old responses even when switching A -> B -> A.
      revision += 1;
      publish({ ...INITIAL_NOTIFICATIONS, projectId });
      void load(projectId);
    },
    load,
    markRead,
  };
}
