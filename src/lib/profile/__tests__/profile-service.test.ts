import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteAgent,
  generateAgentKey,
  listAgents,
  updateAgent,
  validateAgentInput,
} from "@/lib/profile/profile-service";

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

  it("edits, re-keys and deletes agents", async () => {
    const [agent] = await listAgents();

    const updated = await updateAgent(agent.id, { name: "Bebz Prime", speciality: "Market research" });
    assert.equal(updated.name, "Bebz Prime");
    assert.equal((await listAgents())[0].speciality, "Market research");

    const { key, agent: rekeyed } = await generateAgentKey(agent.id);
    assert.match(key, /^zedu_ak_[0-9a-f]{64}$/);
    assert.equal(rekeyed.keyHint, `zedu_ak_…${key.slice(-4)}`);

    await deleteAgent(agent.id);
    assert.ok(!(await listAgents()).some((item) => item.id === agent.id));

  });

  it("rejects invalid edits and unknown agents", async () => {
    await assert.rejects(updateAgent("agent_quill", { name: "", speciality: "x" }), { code: "validation" });
    await assert.rejects(deleteAgent("nope"), { code: "not_found" });
  });
});
