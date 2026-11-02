import type { Notification, NotificationList } from "@/lib/schemas/notifications";

type State = { projectId: string | null; notifications: Notification[]; loading: boolean; failed: boolean };
type RequestList = (url: string, init: RequestInit) => Promise<NotificationList>;

export const INITIAL_NOTIFICATIONS: State = { projectId: null, notifications: [], loading: true, failed: false };

/** Shared inbox state; only the current project's latest request may publish a result. */
export function createNotificationStore(request: RequestList) {
  let state = INITIAL_NOTIFICATIONS;
  let generation = 0;
  let sequence = 0;
  let pendingWrites = 0;
  const listeners = new Set<() => void>();
  const publish = (next: State) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const snapshot = () => state;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  function setProject(projectId: string | null) {
    if (state.projectId === projectId) return;
    generation += 1;
    pendingWrites = 0;
    publish({ ...INITIAL_NOTIFICATIONS, projectId });
  }
  async function load(projectId: string) {
    if (state.projectId !== projectId || pendingWrites > 0) return;
    const epoch = generation;
    const order = ++sequence;
    const current = () => epoch === generation && order === sequence;
    try {
      const list = await request("/api/notifications", { headers: { "x-project-id": projectId } });
      if (current()) publish({ projectId, notifications: list.items, loading: false, failed: false });
    } catch {
      if (current()) publish({ ...state, loading: false, failed: true });
    }
  }
  async function markRead(projectId: string, ids?: string[]) {
    if (state.projectId !== projectId) return;
    const epoch = generation;
    const order = ++sequence;
    pendingWrites += 1;
    const marked = new Set(ids);
    publish({ ...state, notifications: state.notifications.map((note) =>
      !ids || marked.has(note.id) ? { ...note, read: true } : note
    ) });
    try {
      const list = await request("/api/notifications/read", {
        method: "POST", headers: { "x-project-id": projectId }, body: JSON.stringify({ ids }),
      });
      if (epoch === generation && order === sequence) {
        publish({ projectId, notifications: list.items, loading: false, failed: false });
      }
    } catch {
      // Reload after all writes settle to restore authoritative read state on failure too.
    } finally {
      if (epoch === generation) {
        pendingWrites -= 1;
        if (pendingWrites === 0) await load(projectId);
      }
    }
  }
  return { snapshot, subscribe, setProject, load, markRead };
}
