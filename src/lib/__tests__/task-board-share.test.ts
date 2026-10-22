import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTaskBoardShareController, type TaskBoardShareState } from "@/lib/task-board-share";

describe("Task board clipboard lifecycle", () => {
  const url = "https://amp.example/p/demo/tasks?status=all&minPoints=0";

  it("keeps a denied clipboard fallback visible beyond the success timeout", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const states: TaskBoardShareState[] = [];
    const share = createTaskBoardShareController({ writeText: async () => { throw new Error("denied"); }, onChange: state => states.push(state) });
    await share.copy(url);
    t.mock.timers.tick(10000);
    assert.deepEqual(states.at(-1), { status: "error", url });
    share.reset();
    assert.deepEqual(states.at(-1), { status: "idle", url: "" });
  });

  it("copies the exact URL and dismisses only the success announcement", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const states: TaskBoardShareState[] = [];
    const copied: string[] = [];
    const share = createTaskBoardShareController({ writeText: async value => { copied.push(value); }, onChange: state => states.push(state) });
    await share.copy(url);
    assert.deepEqual(copied, [url]);
    t.mock.timers.tick(1799);
    assert.equal(states.at(-1)?.status, "copied");
    t.mock.timers.tick(1);
    assert.equal(states.at(-1)?.status, "idle");
  });

  it("does not let an earlier success timer hide a later failed attempt", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const states: TaskBoardShareState[] = [];
    let calls = 0;
    const share = createTaskBoardShareController({ writeText: async () => { if (++calls === 2) throw new Error("denied"); }, onChange: state => states.push(state) });
    await share.copy(url);
    t.mock.timers.tick(1000);
    await share.copy(url + "&page=2");
    t.mock.timers.tick(10000);
    assert.deepEqual(states.at(-1), { status: "error", url: url + "&page=2" });
  });

  it("ignores an old pending clipboard operation after a newer attempt fails", async () => {
    const states: TaskBoardShareState[] = [];
    let finish!: () => void;
    let calls = 0;
    const share = createTaskBoardShareController({ writeText: () => ++calls === 1 ? new Promise<void>(resolve => { finish = resolve; }) : Promise.reject(new Error("denied")), onChange: state => states.push(state) });
    const pending = share.copy(url);
    await share.copy(url + "&page=2");
    finish();
    await pending;
    assert.deepEqual(states.at(-1), { status: "error", url: url + "&page=2" });
  });

  for (const action of ["reset", "dispose"] as const) {
    it(`cancels success timers and pending callbacks on ${action}`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const states: TaskBoardShareState[] = [];
      let finish!: () => void;
      let calls = 0;
      const share = createTaskBoardShareController({ writeText: () => ++calls === 1 ? Promise.resolve() : new Promise<void>(resolve => { finish = resolve; }), onChange: state => states.push(state) });
      await share.copy(url);
      share[action]();
      let count = states.length;
      t.mock.timers.tick(10000);
      assert.equal(states.length, count);
      const pending = share.copy(url);
      share[action]();
      count = states.length;
      finish();
      await pending;
      assert.equal(states.length, count);
    });
  }
});
