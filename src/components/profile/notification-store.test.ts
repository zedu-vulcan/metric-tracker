import assert from "node:assert/strict";
import { it } from "node:test";
import { createNotificationStore } from "@/components/profile/notification-store";
import type { NotificationList } from "@/lib/schemas/notifications";

function list(id: string, read = false): NotificationList {
  return { items: [{
    id, read, kind: "comment", title: id, message: id, href: "/tasks/t1",
    needsAction: false, createdAt: "2026-10-30T12:00:00.000Z",
  }], unreadCount: read ? 0 : 1 };
}
function setup() {
  const calls: {
    url: string; init: RequestInit;
    resolve: (list: NotificationList) => void; reject: (error: Error) => void;
  }[] = [];
  const store = createNotificationStore((url, init) => new Promise((resolve, reject) => {
    calls.push({ url, init, resolve, reject });
  }));
  store.setProject("A");
  return { store, calls };
}

for (const fail of [false, true]) {
  for (const returnToA of [false, true]) {
    it(`ignores old project ${fail ? "failures" : "responses"}${returnToA ? " after A → B → A" : ""}`, async () => {
      const { store, calls } = setup();
      const old = store.load("A");
      store.setProject("B");
      if (returnToA) store.setProject("A");
      const active = returnToA ? "A" : "B";
      const latest = store.load(active);
      calls[1].resolve(list("current"));
      await latest;
      const before = store.snapshot();
      if (fail) calls[0].reject(new Error("offline"));
      else calls[0].resolve(list("outdated"));
      await old;
      assert.equal(store.snapshot(), before);
      assert.equal(store.snapshot().projectId, active);
      assert.equal(new Headers(calls[1].init.headers).get("x-project-id"), active);
    });
  }
  it(`ignores superseded ${fail ? "failures" : "responses"} within the same project`, async () => {
    const { store, calls } = setup();
    const old = store.load("A");
    const latest = store.load("A");
    calls[1].resolve(list("latest"));
    await latest;
    const before = store.snapshot();
    if (fail) calls[0].reject(new Error("offline"));
    else calls[0].resolve(list("outdated"));
    await old;
    assert.equal(store.snapshot(), before);
  });
  it(`ignores a pending mark-read ${fail ? "failure" : "response"} after switching projects`, async () => {
    const { store, calls } = setup();
    const write = store.markRead("A", ["note"]);
    store.setProject("B");
    const latest = store.load("B");
    calls[1].resolve(list("B"));
    await latest;
    const before = store.snapshot();
    if (fail) calls[0].reject(new Error("offline"));
    else calls[0].resolve(list("A", true));
    await write;
    assert.equal(store.snapshot(), before);
    assert.equal(calls.length, 2, "old write must not start another request");
    await store.markRead("A");
    await store.load("A");
    assert.equal(store.snapshot(), before, "stale callbacks must not mutate project B");
    assert.equal(calls.length, 2);
    assert.equal(new Headers(calls[0].init.headers).get("x-project-id"), "A");
  });
}

it("keeps optimistic read state during polling and reconciles concurrent writes", async () => {
  const { store, calls } = setup();
  const initial = store.load("A");
  calls[0].resolve(list("note"));
  await initial;
  const oldPoll = store.load("A");
  const first = store.markRead("A", ["note"]);
  const second = store.markRead("A");
  assert.equal(store.snapshot().notifications[0].read, true);
  await store.load("A");
  assert.equal(calls.length, 4, "polling waits while writes are pending");
  calls[1].resolve(list("note"));
  await oldPoll;
  assert.equal(store.snapshot().notifications[0].read, true);
  calls[3].resolve(list("note", true));
  await second;
  calls[2].resolve(list("note"));
  await Promise.resolve();
  assert.equal(calls[4].url, "/api/notifications");
  calls[4].resolve(list("note", true));
  await first;
  assert.equal(store.snapshot().notifications[0].read, true);
  assert.equal(calls[2].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), { ids: ["note"] });
  assert.deepEqual(JSON.parse(String(calls[3].init.body)), {});
});

it("recovers from a failed read action and exposes a current load failure", async () => {
  const { store, calls } = setup();
  const write = store.markRead("A");
  calls[0].reject(new Error("offline"));
  await Promise.resolve();
  calls[1].resolve(list("still unread"));
  await write;
  assert.equal(store.snapshot().notifications[0].read, false);
  const reload = store.load("A");
  calls[2].reject(new Error("offline"));
  await reload;
  assert.equal(store.snapshot().failed, true);
  assert.equal(store.snapshot().loading, false);
});

it("ignores a previous visit's mark-read response when returning to the same project", async () => {
  const { store, calls } = setup();
  const write = store.markRead("A");
  store.setProject("B");
  store.setProject("A");
  const current = store.load("A");
  calls[0].resolve(list("old visit", true));
  await write;
  assert.equal(store.snapshot().loading, true);
  assert.equal(store.snapshot().notifications.length, 0);
  assert.equal(calls.length, 2);
  calls[1].resolve(list("new visit"));
  await current;
  assert.equal(store.snapshot().notifications[0].id, "new visit");
});

it("notifies subscribers of resets and invalidates requests on unmount", async () => {
  const { store, calls } = setup();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  const pending = store.load("A");
  store.setProject(null);
  calls[0].resolve(list("old"));
  await pending;
  assert.equal(store.snapshot().projectId, null);
  assert.equal(store.snapshot().notifications.length, 0);
  assert.equal(notifications, 1);
  unsubscribe();
  store.setProject("B");
  assert.equal(notifications, 1);
});
