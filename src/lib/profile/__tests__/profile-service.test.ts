import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addNotification,
  deleteAgent,
  generateAgentKey,
  listAgents,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateAgent,
  validateAgentInput,
} from "@/lib/profile/profile-service";

const unread = async () => (await listNotifications()).filter((note) => !note.read).length;

describe("Profile service (demo)", () => {
  it("validates agent names and specialisations", () => {
    assert.deepEqual(validateAgentInput({ name: "Quill", speciality: "Content" }), {});
    const errors = validateAgentInput({ name: " ", speciality: "x" });
    assert.ok(errors.name);
    assert.ok(errors.speciality);
  });

  it("never lists a full key", async () => {
    for (const agent of await listAgents()) {
      assert.match(agent.keyHint, /^zedu_ak_…[0-9a-f]{4}$/);
    }
  });

  it("marks notifications read one by one and all at once", async () => {
    const before = await unread();
    assert.equal(before, 3);
    const first = (await listNotifications()).find((note) => !note.read)!;
    await markNotificationRead(first.id);
    assert.equal(await unread(), 2);
    await markAllNotificationsRead();
    assert.equal(await unread(), 0);
  });

  it("edits, re-keys and deletes agents, and adds unread notifications", async () => {
    const [agent] = await listAgents();

    const updated = await updateAgent(agent.id, { name: "Bebz Prime", speciality: "Market research" });
    assert.equal(updated.name, "Bebz Prime");
    assert.equal((await listAgents())[0].speciality, "Market research");

    const { key, agent: rekeyed } = await generateAgentKey(agent.id);
    assert.match(key, /^zedu_ak_[0-9a-f]{64}$/);
    assert.equal(rekeyed.keyHint, `zedu_ak_…${key.slice(-4)}`);

    await deleteAgent(agent.id);
    assert.ok(!(await listAgents()).some((item) => item.id === agent.id));

    const note = await addNotification({ kind: "agent_deleted", title: "Agent deleted", message: "Bebz Prime was removed." });
    assert.equal(note.read, false);
    assert.equal((await listNotifications())[0].id, note.id);
    assert.equal(await unread(), 1);
  });

  it("rejects invalid edits and unknown agents", async () => {
    await assert.rejects(updateAgent("agent_quill", { name: "", speciality: "x" }), { code: "validation" });
    await assert.rejects(deleteAgent("nope"), { code: "not_found" });
    await assert.rejects(markNotificationRead("nope"), { code: "not_found" });
  });
});
