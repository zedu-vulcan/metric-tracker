import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createNotificationsStore } from "@/components/profile/notifications-store";
import type { NotificationList } from "@/lib/schemas/notifications";

function feed(id: string, read = false): NotificationList {
  return {
    items: [{
      id, kind: "comment", title: id, message: "A task needs your attention", href: "/tasks/t1", needsAction: true,
      createdAt: "2026-11-01T12:00:00.000Z", read,
    }],
    unreadCount: read ? 0 : 1,
  };
}

function setup() {
  const requests: { url: string; init?: RequestInit; resolve: (list: NotificationList) => void; reject: (error: Error) => void }[] = [];
  const store = createNotificationsStore((url, init) => new Promise<NotificationList>((resolve, reject) => {
    requests.push({ url, init, resolve, reject });
  }));
  return { store, requests };
}

describe("Project inbox requests", () => {
  for (const outcome of ["success", "failure"] as const) {
    it(`ignores an old project's late ${outcome}`, async () => {
      const { store, requests } = setup();
      store.activate("project-a");
      store.activate("project-b");
      requests[1].resolve(feed("b"));
      await Promise.resolve();
      const current = store.getSnapshot();
      if (outcome === "success") requests[0].resolve(feed("a"));
      else requests[0].reject(new Error("Old request failed"));
      await Promise.resolve();
      assert.equal(store.getSnapshot(), current);
      assert.equal(current.projectId, "project-b");
      assert.equal(current.notifications[0].id, "b");
      assert.equal(current.loading, false);
      assert.equal(current.failed, false);
    });
  }

  it("invalidates an old response when switching A -> B -> A", async () => {
    const { store, requests } = setup();
    store.activate("a");
    store.activate("b");
    store.activate("a");
    requests[2].resolve(feed("new-a"));
    await Promise.resolve();
    requests[0].resolve(feed("old-a"));
    await Promise.resolve();
    assert.equal(store.getSnapshot().notifications[0].id, "new-a");
  });

  it("clears the old inbox immediately and notifies all subscribers", async () => {
    const { store, requests } = setup();
    store.activate("a");
    requests[0].resolve(feed("a"));
    await Promise.resolve();
    let badgeUpdates = 0;
    let inboxUpdates = 0;
    const unsubscribe = store.subscribe(() => { badgeUpdates += 1; });
    store.subscribe(() => { inboxUpdates += 1; });
    store.activate("b");
    assert.equal(store.getSnapshot().loading, true);
    assert.deepEqual(store.getSnapshot().notifications, []);
    assert.equal(badgeUpdates, 1);
    assert.equal(inboxUpdates, 1);
    unsubscribe();
    requests[1].resolve(feed("b"));
    await Promise.resolve();
    assert.equal(badgeUpdates, 1);
    assert.equal(inboxUpdates, 2);
  });

  it("keeps the newest refresh when responses arrive out of order", async () => {
    const { store, requests } = setup();
    store.activate("a");
    const refresh = store.load("a");
    requests[1].resolve(feed("new"));
    await refresh;
    requests[0].resolve(feed("old"));
    await Promise.resolve();
    assert.equal(store.getSnapshot().notifications[0].id, "new");
  });

  for (const outcome of ["success", "failure"] as const) {
    it(`ignores a mark-read ${outcome} after switching projects`, async () => {
      const { store, requests } = setup();
      store.activate("a");
      requests[0].resolve(feed("a"));
      await Promise.resolve();
      const marking = store.markRead("a", ["a"]);
      assert.equal(store.getSnapshot().notifications[0].read, true);
      assert.equal(requests[1].url, "/api/notifications/read");
      assert.equal(new Headers(requests[1].init?.headers).get("x-project-id"), "a");
      store.activate("b");
      requests[2].resolve(feed("b"));
      await Promise.resolve();
      const current = store.getSnapshot();
      if (outcome === "success") requests[1].resolve(feed("a", true));
      else requests[1].reject(new Error("Old mutation failed"));
      await marking;
      assert.equal(store.getSnapshot(), current);
      assert.equal(requests.length, 3);
    });
  }

  it("pins requests to their project and ignores stale callbacks", async () => {
    const { store, requests } = setup();
    store.activate("a");
    store.activate("b");
    assert.equal(new Headers(requests[0].init?.headers).get("x-project-id"), "a");
    assert.equal(new Headers(requests[1].init?.headers).get("x-project-id"), "b");
    await store.markRead("a");
    await store.load("a");
    assert.equal(requests.length, 2);
  });

  it("reports current failures and recovers on retry", async () => {
    const { store, requests } = setup();
    store.activate("a");
    requests[0].reject(new Error("Offline"));
    await Promise.resolve();
    assert.equal(store.getSnapshot().failed, true);
    assert.equal(store.getSnapshot().loading, false);
    const retry = store.load("a");
    requests[1].resolve(feed("a"));
    await retry;
    assert.equal(store.getSnapshot().failed, false);
    assert.equal(store.getSnapshot().notifications[0].id, "a");
  });
});
