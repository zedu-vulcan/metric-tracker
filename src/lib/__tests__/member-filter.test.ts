import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterMembers, type FilterableMember } from "@/lib/member-filter";

const MEMBERS: (FilterableMember & { userId: string })[] = [
  { userId: "u1", name: "Ada Lovelace", email: "ada@acme.test", role: "owner" },
  { userId: "u2", name: "Grace Hopper", email: "grace@navy.test", role: "admin" },
  { userId: "u3", name: "Alan Turing", email: "Alan@Bletchley.test", role: "member" },
  { userId: "u4", name: null, email: "nameless@acme.test", role: "member" },
  { userId: "u5", name: "No Email", email: null, role: "member" },
];

const ids = (members: { userId: string }[]) => members.map((member) => member.userId);

describe("filterMembers", () => {
  it("returns everyone when the search is empty and the role is any", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "", role: "all" })), ["u1", "u2", "u3", "u4", "u5"]);
  });

  it("matches a partial name case-insensitively", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "lovel", role: "all" })), ["u1"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "LOVELACE", role: "all" })), ["u1"]);
  });

  it("matches a partial email case-insensitively", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "bletchley", role: "all" })), ["u3"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "ACME", role: "all" })), ["u1", "u4"]);
  });

  it("ignores surrounding whitespace in the search", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "  hopper  ", role: "all" })), ["u2"]);
  });

  it("filters by role alone", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "", role: "member" })), ["u3", "u4", "u5"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "", role: "owner" })), ["u1"]);
  });

  it("requires both the search and the role to match", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "acme", role: "owner" })), ["u1"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "acme", role: "member" })), ["u4"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "acme", role: "admin" })), []);
  });

  it("matches members with no name or no email without throwing", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "nameless", role: "all" })), ["u4"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "no email", role: "all" })), ["u5"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "unfindable", role: "all" })), []);
  });

  it("returns the full list again once the filters are cleared", () => {
    const filtered = filterMembers(MEMBERS, { query: "ada", role: "owner" });
    assert.deepEqual(ids(filtered), ["u1"]);
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: "", role: "all" })), ids(MEMBERS));
  });

  it("keeps the incoming order", () => {
    assert.deepEqual(ids(filterMembers(MEMBERS, { query: ".test", role: "all" })), ["u1", "u2", "u3", "u4"]);
  });
});
