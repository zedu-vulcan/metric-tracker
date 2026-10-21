# Backend Implementation Review — Zedu Marketing Agent Platform

> **Task 5.2** · Review of the Goals / Workstreams / Tasks / Conversations backend built across Epics 1–4.
> **Reviewed baseline**: branch `feat/goals-workstreams-backend` @ `04004a2` (20 Oct 2026).
> **Reviewer scope**: architecture, security, concurrency, tests, OpenAPI contract, and client readiness.
> **Method**: full read of `src/lib/{api,agents,auth,ideas,inbox,tasks,workstreams,task-comments,task-comment-store,task-acceptance,task-approval}.ts`, all 22 platform route handlers, all `src/lib/schemas/*` validation modules, `prisma/schema.prisma`, `src/lib/openapi.ts`, and execution of the full test suite (`npm test`: 19 suites / 149 tests, all passing).

---

## 0. Executive summary

The backend is in **good shape overall and is safe to build a frontend and agent fleet against**, with a handful of real defects worth fixing before it carries production traffic.

**Strengths.** The data model matches the spec exactly (no due dates, no points). Auth context cleanly distinguishes humans from agents. The hardest parts of the lifecycle — acceptance, approval, typed comments and the 2-round revision engine — are implemented as small, dependency-injected handlers guarded by *atomic conditional updates* (`updateMany` with a status predicate) inside Prisma transactions, and that logic is genuinely unit-tested, including the concurrent-update path.

**Main risks.** (1) Four transitions — idea accept/reject, task offer, accept-offer — still use non-atomic read-then-write and can be won twice by concurrent callers. (2) Two different `requireAgent` implementations exist, so `X-Agent-Key` works on some agent routes and 401s on others. (3) `tasks/[id]/approve` lets *any* authenticated human approve, while the comments route enforces the Review Coordinator role — the acceptance criterion for Task 4.4 is only half met. (4) There is no true integration test: all 19 suites are unit/injected-fake based and none touches a database, so the Prisma queries themselves are unverified. (5) Goals/tasks have no ownership scoping, unlike agents.

**Verdict**: **Ready for frontend + agent integration now** (with the caveats in §6). **Not yet production-ready** — see the five blocking items in §7.

---

## 1. Architecture & Workflow Evaluation

### 1.1 Layering

The implementation follows a clean three-layer shape that makes routes trivially readable:

| Layer | Location | Role |
|---|---|---|
| Route handlers | `src/app/api/<feature>/**/route.ts` | HTTP plumbing only: auth call, parse, delegate, serialize |
| Services / state machine | `src/lib/*.ts` | Lifecycle rules, transactions, serialization |
| Schemas | `src/lib/schemas/*.ts` | Zod validation + OpenAPI registration |

Handlers such as `tasks/[id]/accept`, `tasks/[id]/approve` and `tasks/[id]/comments` are ~20 lines and inject their dependencies (`requireUser`, `findTask`, `acceptProposedTask`, `prisma.$transaction`) into factory functions (`createTaskAcceptanceHandler`, `createTaskApprovalHandler`, `createTaskCommentHandler`). This is the single best architectural decision in the codebase: it is what makes the concurrency behavior testable at all, and `task-revisions.test.ts` proves it by driving competing writes through fake stores.

### 1.2 Lifecycle fidelity to the build spec

Verified against `doc/GOALS_TASKLIST.md` §1 and §3:

| Spec requirement | Implemented | Where |
|---|---|---|
| Goal: no due date/time | ✅ | `Goal` model has only `createdAt`/`updatedAt` |
| Task: 9-state status enum | ✅ | `TaskStatus` (`proposed → open → bidding → in_progress → submitted/in_review → changes_requested → approved / reopened`) |
| `revisionCount` / `maxRevisions` (default 2) | ✅ | `Task` model, enforced in `task-comments.ts` |
| Idea = `Workstream` row with `status: proposed` | ✅ | `schemas/ideas.ts` documents the reuse; accept flips the same record |
| Typed comments (8 types) + attachment isolation | ✅ | `TaskComment.type`, `commentCreateSchema` |
| Deliverable requires attachment | ✅ | Zod `.refine` + server-side guard |
| Task creation branches on `autoAcceptTasks` (`open` vs `proposed`) | ✅ | `workstreams/[id]/tasks` |
| Offer: 24h expiry, `offerExpiresAt` | ✅ | `tasks/[id]/offer`, `inbox.expireOffers` |
| Accept-offer: max 2 active tasks, clear offer fields | ✅ | `tasks/[id]/accept-offer` |
| Review cap: 4 per delivery round | ✅ | `countReviewsSinceLastDelivery` |
| Revision cap: 2 rounds then unassign + `reopened`, count reset | ✅ | `task-comments.ts` (`revisionLimit = Math.min(task.maxRevisions, 2)` — the stored cap is defensively clamped, good) |
| No points anywhere | ✅ | No points field in schema, serializers or OpenAPI |

The whole 10-step lifecycle in Task 5.1 (goal → idea → workstream → task → accept → bid → offer → accept-offer → delivery → review → revision → approve) is expressible with the routes that exist. Nothing in the spec is missing at the route level.

### 1.3 Architectural smells

- **Dual task model.** The legacy CRM `Task` fields (`type` enum `Call/Email/FollowUp/Meeting/Other`, `dueAt`, `done`, `completedAt`, `ownerId`, `userId`) coexist with the platform fields (`taskType` string, `status`). `serializeTask` serves both, and fabricates data when it does (see §6.1). This is the biggest structural wart; it predates Epics 1–4 but leaks into the platform's task endpoints.
- **Duplicated helpers.** `extractAgentKey` (in `api.ts`) and `extractAgentApiKey` (in `workstreams.ts`) are the same function. `goalTypeSchema`/`goalStatusSchema` are defined twice (`schemas/goals.ts` and `schemas/workstreams.ts`). `requireAgent` exists twice (see §2.1).
- **Doc drift in the task list.** `doc/GOALS_TASKLIST.md` still shows Task 4.4 and Epic 4/5 as unchecked in the §2 checklist (lines 88–96), even though 4.4 is implemented and 5.2 has been redefined in the detailed section. The checklist and the detailed spec now disagree.

---

## 2. Security & Authorization Review

### 2.1 Agent authentication — two conflicting implementations ⚠️ **High**

There are **two different `requireAgent` functions**:

| | `@/lib/api.ts:159` | `@/lib/agents.ts:49` |
|---|---|---|
| Accepted headers | `X-Agent-Key` **or** `Authorization: Bearer` | `Authorization: Bearer` **only** |
| Key format check | none | requires `zedu_ak_` prefix |
| `lastActiveAt` write | **every request** (extra DB write per call) | throttled to once per 60s (`ACTIVITY_WRITE_INTERVAL_MS`) |

Used inconsistently: `goals/[id]/ideas` and `me/inbox` import from `@/lib/api`; `agent/register` and `agent/me` import from `@/lib/agents`. **Consequence**: an agent that authenticates with `X-Agent-Key` succeeds on inbox/idea routes but receives `401` on `register`/`me`. The build spec (Task 1.2) explicitly permits both headers. This is a live integration bug for agent authors.

**Recommendation**: keep the `agents.ts` version (prefix check + throttled writes) as the single implementation, re-export it from `api.ts`, and delete the other. That fixes both the header inconsistency and the write amplification.

### 2.2 Positive security findings

- **Keys are hashed, not stored.** `hashAgentKey` = SHA-256 over the key; only `keyHash` + `keyHint` (`zedu_ak_…last4`) are persisted; the raw key is returned exactly once (`agents/route.ts:POST`, `agents/[id]/key/route.ts`). Rotation invalidates the old key immediately. This is correct practice.
- **Agent routes are owner-scoped.** Every `agents` CRUD route filters `where: { id, ownerId: userId }` and returns `404` (not `403`) to non-owners, so agent existence is not leaked. Key rotation re-checks ownership before updating.
- **Human-only endpoints reject agents.** `requireUser` (used by goal creation, task acceptance, approval, offers) returns `403` for a valid agent key, so an agent cannot promote its own proposals to `open` or approve its own delivery.
- **Review Coordinator fail-closed.** `isReviewCoordinator(userId, process.env.REVIEW_COORDINATOR_USER_IDS)` parses the env list and returns `false` when unset/empty — the revision gate fails closed rather than open (verified by `task-revisions.test.ts`: "uses exact configured coordinator IDs and fails closed when unset").
- **Self-review and cross-owner revision guards.** A worker cannot review its own delivery (403), and a revision requester must belong to a different user than the worker (403) — the "self-review rejected" edge case from Task 5.1 is enforced server-side.

### 2.3 Authorization gaps

1. **Task 4.4 acceptance criterion is only half met.** The spec says "Only authorized human users (Review Coordinator / Project Owner) can approve." `tasks/[id]/approve` calls plain `requireUser` — **any** authenticated human can approve any task. The stricter coordinator check exists only in the comments route. Either gate approval on `isReviewCoordinator || task owner`, or consciously document "any human = project owner" and align the task list wording.
2. **No ownership scoping on goals and tasks.** `GET /api/goals` returns every goal in the database; `GET/PATCH/DELETE /api/goals/{id}` and `/api/tasks/{id}` operate on any id. The agent routes *do* scope by owner, so this is inconsistent. In a single-tenant Zedu deployment this is acceptable today; it is a hard blocker the moment a second customer or an external agent-owner is onboarded.
3. **Weak agent-detection heuristics in goals routes.** `goals` POST and `goals/[id]` PATCH sniff `x-agent-key` / `authorization: bearer` *before* calling `requireAuth` and return `403`. Header sniffing is not identity: a human request that legitimately carries a `Bearer` token is wrongly blocked, and an unauthenticated caller gets `403` where `401` is expected. `requireUser` already returns `403` for agents — the pre-check is redundant and should be removed.
4. **Approve endpoint has no rate or role check at all** beyond the session; combined with #1 this is the single most sensitive endpoint in the platform.

---

## 3. Concurrency & Transaction Safety

### 3.1 The strong parts (majority of the lifecycle)

Six state transitions use **atomic conditional updates** and are correct under contention:

| Transition | Guard | Location |
|---|---|---|
| propose → open (accept) | `updateMany({ where: { id, status: "proposed" } })`, 0 rows ⇒ 409 recheck | `tasks/[id]/accept` |
| delivery / review / revision / escalation | `prisma.$transaction` + `updateMany` with the full observed predicate (status + workstreamId + assignedAgentId + revisionCount) | `task-comment-store.ts:changeTask` — comment in code correctly notes "PostgreSQL rechecks this predicate after a competing update acquires the row lock" |
| approval | `$transaction` + `tx.task.updateMany({ where: { status: { in: ["submitted","in_review"] } } })` | `tasks/[id]/approve` |
| offer expiry | `updateMany({ where: { offerExpiresAt: { lt: now }, status: { not: in_progress } } })` | `inbox.ts:expireOffers` |
| `revisionCount` reset/unassign | same conditional pattern; a losing writer gets `409` "Task changed while posting the comment" | `task-comments.ts` |

`writeTaskComment` correctly keeps the status change and the comment insert in **one** transaction, so a failure rolls back both — there is no state where the task moved but the audit comment is missing. The `task-revisions.test.ts` suite explicitly simulates "two competing requests against the same delivered version" and asserts exactly one wins. This is the hardest correctness requirement in the spec and it is met.

### 3.2 The weak parts ⚠️ **High**

Four routes still do read-then-write with **no status predicate** on the write, so two concurrent callers can both pass the guard and the last write wins:

1. **`POST /api/tasks/{id}/accept-offer`** — the most important one. Checks expiry, agent match and the "max 2 active tasks" cap, then calls plain `prisma.task.update`. Two consequences:
   - two concurrent accepts (same agent or the offer being re-issued) can double-assign;
   - the active-task cap is a **count-then-update** with no lock, so two concurrent accepts by the same agent can both see `1 < 2` and end up with 3 in-progress tasks — violating the Task 3.3 acceptance criterion under load.
   - Fix: `updateMany({ where: { id, status: "bidding", offeredToAgentId: agent.id, offerExpiresAt: { gt: now } }, ... })` and run the cap check inside the same `$transaction` (or add a serializable/isolation hint on the count).
2. **`POST /api/tasks/{id}/offer`** — updates without a status predicate, so it can overwrite a concurrent `accept-offer` and shove an already-assigned task back to `bidding`.
3. **`POST /api/ideas/{id}/accept`** and **`/reject`** — read the workstream, then `update` unconditionally. A double-click or two humans can race; worse, a reject can overwrite a concurrent accept (or vice versa), leaving `status` and `acceptedById` inconsistent.
4. **`POST /api/goals/{id}/ideas`** — the "max 5 pending ideas per agent" cap and the duplicate-title check are count-then-create. The duplicate case is *handled* (P2002 unique-violation is caught and mapped to `409`), which is the right instinct; the cap is not, so a burst can exceed 5.

All four are the same one-line fix pattern already used elsewhere in this codebase; nothing architectural needs to change.

### 3.3 Minor

- `task-acceptance`/`task-approval` handlers re-check after a 0-row update, so the optimistic path degrades to a clean 400/409 rather than a stale success. Good.
- `GET /api/me/inbox` performs a **write** (`expireOffers`) as a side effect of a read. It is atomic and idempotent, but a read endpoint mutating global state is surprising; it also means every agent poll pays a write. Acceptable at current scale; consider moving expiry to a scheduled job or a lightweight cron route.

---

## 4. Test Suite Review & Coverage Analysis

### 4.1 Inventory — 19 suites, 149 tests, all passing

Runner: `npm test` → `tsx --test "src/**/*.test.ts"` (Node's built-in `node:test`, not Vitest/Jest as Task 5.1's prose suggests — no framework config exists). The "19 test suites" figure in this task's acceptance criteria corresponds to the **19 top-level `describe` blocks** across 11 files.

| File | Suites | Tests | Style |
|---|---:|---:|---|
| `src/lib/__tests__/comments.test.ts` | 3 | 9 | Pure unit (schema + OpenAPI assertions) |
| `src/lib/__tests__/ideas.test.ts` | 1 | 6 | Pure unit |
| `src/lib/__tests__/inbox.test.ts` | 1 | 5 | Pure unit |
| `src/lib/__tests__/task-acceptance.test.ts` | 1 | 8 | Injected fakes |
| `src/lib/__tests__/task-approval.test.ts` | 1 | 11 | Injected fakes |
| `src/lib/__tests__/task-revisions.test.ts` | 2 | 27 | Injected fakes + structural Prisma transaction fakes |
| `src/lib/__tests__/tasks.test.ts` | 4 | 17 | Pure unit |
| `src/lib/__tests__/workstreams.test.ts` | 1 | 7 | Pure unit |
| **Platform subtotal** | **14** | **90** | |
| `src/lib/seo/__tests__/ssrf.test.ts` | 3 | 48 | Pure unit (legacy SEO feature) |
| `src/lib/seo/__tests__/scoring.test.ts` | 1 | 5 | Pure unit |
| `src/lib/seo/__tests__/checks.test.ts` | 1 | 6 | Pure unit |
| **Total** | **19** | **149** | |

Result: `ℹ tests 149 / suites 19 / pass 149 / fail 0`.

### 4.2 Quality assessment

**Genuinely good coverage of the hard logic.** `task-revisions.test.ts` (27 tests) is the standout: it covers both revision rounds with the same worker, unassignment on the 3rd request, the clamped `maxRevisions`, the "does not consume a round while changes are outstanding" rule, all 7 non-revisionable statuses, the 3 unauthorized actor classes, stale-offer clearing, fresh cycles after reassignment, and a **simulated race** where a competing transition wins (`409` with no comment written). `task-approval.test.ts` (11) covers default/custom approval bodies, all non-approvable statuses, post-approval locking, and a concurrent-change case. Boundary conditions (score 1–10, body max 10 000, title max 200, empty body) are asserted directly against the Zod schemas.

**Mock fidelity — mostly honest, one weakness.** No test module-mocks `@/lib/prisma`; instead the handler tests inject fakes and the revision tests build structural `Prisma.TransactionClient` doubles cast via `as unknown as`. That is the correct pattern for this design and it does exercise the real state-machine code. The weakness is that the fakes **reimplement** the atomicity the real database provides — `changeTask` fakes return `count: 1`, so the tests prove the handler honors a lost race, but they cannot prove the real `updateMany` predicate is actually discriminating. Only Task 5.1's integration tests (or a real Postgres) can do that.

**The gaps that matter (all trace back to the missing integration layer):**

| Not covered by any test | Risk |
|---|---|
| Any Prisma query against a real database | Query shape, `select`/`include` typos, cascade behavior, migration drift |
| The non-atomic transitions in §3.2 | The known races are invisible to the current suite |
| The 24h offer-expiry write path end-to-end | Only `secondsUntil` (pure math) is tested; `expireOffers` itself is not |
| HTTP layer: status codes, JSON serialization of responses | Routes are only indirectly tested through injected handlers |
| The two-`requireAgent` inconsistency (§2.1) | The header-format bug ships unnoticed |
| `getAuthContext` / `requireUser` / `requireAgent` themselves | Zero direct tests on the most security-critical functions in the app |

**Verdict on tests**: excellent unit depth on the state machine, **zero** breadth on the database and HTTP layers. Coverage percentages would be misleading here — the honest statement is: *the lifecycle rules are well tested; the wiring is untested.*

---

## 5. OpenAPI & Contract Compliance

`src/lib/openapi.ts` registers **60 operations** across 37+ paths at `/docs`, served by `/api/openapi`. Audited for parity with the platform routes:

| Platform endpoint | Registered | Auth scheme declared |
|---|---|---|
| `GET/POST /api/goals`, `GET/PATCH /api/goals/{id}` | ✅ | session (human) |
| `POST /api/goals/{id}/ideas`, `POST /api/ideas/{id}/accept`, `/reject` | ✅ | agentKey / session |
| `GET /api/workstreams`, `GET /api/workstreams/{id}`, `PATCH .../auto-accept` | ✅ | session + agentKey |
| `POST /api/workstreams/{id}/tasks` | ✅ | session + agentKey |
| `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}` | ✅ | session |
| `POST /api/tasks/{id}/accept`, `/offer`, `/accept-offer`, `/approve` | ✅ | session / agentKey |
| `GET/POST /api/tasks/{id}/comments` | ✅ | session + agentKey |
| `GET /api/me/inbox` | ✅ | agentKey |
| `GET/POST /api/agents`, `GET/PATCH /api/agents/{id}`, `POST .../key` | ✅ | session |
| `POST /api/agent/register`, `GET /api/agent/me` | ✅ | agentKey |

Compliance findings:

- ✅ **No points fields** anywhere in the platform schemas or responses.
- ✅ **No CRM mandatory due dates** on the platform schemas (`GoalTaskCreate`, `TaskApprove`, `IdeaCreate`, `CommentCreate`, inbox, offers). The only `dueAt` in the contract belongs to the **legacy** `/api/tasks` CRUD (`taskCreateSchema` requires it), which is the pre-existing CRM surface, not the Goals platform.
- ⚠️ **`goalDetailSchema` is loosely typed**: `acceptedWorkstreams: z.array(z.any())` and `pendingIdeas: z.array(z.any())` (`schemas/goals.ts:76-77`). The most important read endpoint in the product is documented as "array of anything". Reuse `workstreamItemSchema` / `ideaItemSchema` here — both already exist.
- ⚠️ **Some responses are re-parsed with throwing `.parse`** (`taskOfferedSchema.parse(...)`, `ideaCreateSchema.parse(...)`) rather than a validated serializer. A serialization drift becomes an unhandled 500 instead of a caught contract error.
- ⚠️ `GET /api/tasks` query params (`status`, `type`, `assignedToMe`) are parsed manually, not with a Zod schema, so they are undocumented and invalid values are silently ignored — inconsistent with every other list route.
- ⚠️ `GET /api/goals/{id}` and `GET /api/workstreams/{id}` return shapes that are not schema-validated on the way out, so the documented contract is not actually enforced in code.

---

## 6. Frontend & Agent Readiness — defects, tech debt, gotchas

Ordered by impact on a client integrating right now.

### Blocking-ish (fix before agents go live)

1. **Two `requireAgent` implementations** (§2.1) — `X-Agent-Key` silently 401s on `/api/agent/register` and `/api/agent/me`. Every agent author will hit this first. *Effort: small — re-export one function.*
2. **Non-atomic accept-offer and offer** (§3.2) — real double-assignment and 3-active-task bugs under concurrency. *Effort: small — `updateMany` predicate + one `$transaction`.*
3. **Approval has no coordinator gate** (§2.3.1) — contradicts the Task 4.4 acceptance criterion. *Effort: small — reuse `isReviewCoordinator`, already tested.*

### Should fix soon

4. **`serializeTask` fabricates a due date.** `src/lib/tasks.ts:14`: `dueAt: task.dueAt ? task.dueAt.toISOString() : new Date().toISOString()` — a task with **no** due date is serialized with **"now"**, so the frontend will render a due date that does not exist and that changes on every fetch. This directly violates the "no due dates" spirit of the spec on the legacy task endpoints. Return `null`.
5. **Malformed JSON returns `500` on `POST /api/workstreams/{id}/tasks`** — the only platform route where `await req.json()` is unwrapped. Every other route maps bad JSON to `400`. This route is also the only one missing `export const dynamic = "force-dynamic"` and the only one that does not validate `params.id` (a malformed id reaches Prisma and throws).
6. **Idea accept/reject races** (§3.2.3) — two humans clicking accept+reject can produce `status: "rejected"` with `acceptedById` set. Frontends should be told to treat the response as authoritative and re-fetch.
7. **`goalDetailSchema` `z.any()` arrays** (§5) — frontend codegen from `/docs` yields `any[]` for the goal detail payload.

### Integration gotchas to document for clients

- **`requireAuth()` takes no request** — it resolves the NextAuth session only, so every route using it (goals, idea accept/reject, task CRUD, offer, agents) rejects agents with `401` *by design*. Agents must use `getAuthContext`-based routes. This is correct but undocumented; the agent integration guide should list which endpoints are human-only.
- **`GET /api/me/inbox` writes to the database** (expires offers) — do not call it from a read-only replica path or during tests expecting no side effects.
- **Comments `POST` returns `409` on lost races** — clients must treat `409` as "reload and retry", not as an error.
- **`accept-offer` returns `401` (not `403`) for a human caller** — asymmetric with the rest of the API where humans get `403` on agent routes.
- **`acceptedById` is set on rejection too** — the field really means "decidedBy"; frontend should not label it "accepted by".
- **Legacy vs platform task fields** — `/api/tasks` responses carry both `type` (CRM enum) and `taskType` (platform string), plus `done`/`completedAt`. Only `taskType`/`status` are meaningful for the Goals platform.
- **`REVIEW_COORDINATOR_USER_IDS` must be set in Coolify** — with it unset, *nobody* can request revisions or approve via the coordinator path, and the failure is silent (fail-closed). Add it to `.env.example` (placeholders only) and to the deployment checklist.

### Tech debt (non-urgent)

- Duplicate `extractAgentKey` / `extractAgentApiKey`; duplicated `goalTypeSchema`/`goalStatusSchema` in two schema files.
- Manual agent-header sniffing in the goals routes (§2.3.3) — remove in favor of `requireUser`.
- Every authenticated agent call in `api.ts` performs a `lastActiveAt` write (no throttle, unlike `agents.ts`).
- `tasks/[id]/accept-offer` validates `offerAcceptSchema.safeParse({})` and never reads the body — dead validation code that suggests a payload exists when none does.
- Dual `TaskType` enum vs `taskType` string should be collapsed eventually (needs a migration — needs user confirmation per repo rules).

---

## 7. Readiness Verdict

### For frontend / agent integration: **GO** ✅

The contract is stable, complete and documented at `/docs`; every spec'd endpoint exists and returns consistent shapes; the failure modes (`400` validation with field details, `401`/`403` auth, `404`, `409` conflicts) are uniform enough to code against. Teams can start today, provided the following caveats are published to them:

1. Use `Authorization: Bearer zedu_ak_…` (not `X-Agent-Key`) on **all** agent endpoints until the duplicate `requireAgent` is merged.
2. Treat `409` on comments/accept/approve as "reload and retry".
3. Ignore `dueAt` on `/api/tasks` responses; it may be a fabricated "now".
4. `GET /api/goals/{id}` payload shape is not typed in the spec — read the route, not the OpenAPI schema.

### For production: **NO-GO until 5 items are fixed** ⛔

> **Re-verification after Task 5.1 (2026-10-20):** all five blockers are now resolved in the working tree of this branch (uncommitted at time of writing, per instruction):
> 1. ✅ Unified `requireAgent` in `src/lib/agents.ts` (accepts `X-Agent-Key` + Bearer; shared `touchAgentActivity()` throttles `lastActiveAt` writes to 60s); `api.ts` re-exports it, `workstreams.ts` delegates to it.
> 2. ✅ Atomic transitions: `accept-offer` (cap check + offer verification inside `prisma.$transaction`, race → `409`), `offer`, `ideas/[id]/accept`, `ideas/[id]/reject` all use conditional `updateMany` with a `409` on lost races; cap violations still return `400`.
> 3. ✅ `/api/tasks/{id}/approve` gated by `canApprove()` — Review Coordinator (`REVIEW_COORDINATOR_USER_IDS`) or the goal creator; unauthorized humans get `403`. Two new unit tests cover this (151 unit tests total).
> 4. ✅ `serializeTask` returns `null` `dueAt` instead of a fabricated timestamp (`taskItemSchema.dueAt` is nullable); `workstreams/[id]/tasks` now has `force-dynamic`, validated `params.id`, and `400` (not `500`) on malformed JSON.
> 5. ✅ Task 5.1 landed (PR #45) and the suite **passes 19/19 against a real PostgreSQL 18.4 + a live `next dev` server**, exercising the fixed code over HTTP: the full 10-step lifecycle, the 24h offer-expiry sweep, the 2-active-task cap, and the 2-revision limit. The `canApprove` gate was validated through the suite's `REVIEW_COORDINATOR_USER_IDS` wiring.
>
> With blockers 1–5 resolved and re-verified, the remaining production blockers are the **secondary** items below (ownership scoping, `goalDetailSchema` typing, coordinator env var in Coolify).

| # | Blocker | Section | Effort | Status |
|---|---|---|---|---|
| 1 | Unify `requireAgent` (header handling + throttled writes) | §2.1 | Small | ✅ resolved |
| 2 | Make accept-offer / offer / idea-accept / idea-reject atomic (`updateMany` predicate; cap check inside a transaction) | §3.2 | Small | ✅ resolved |
| 3 | Gate `/api/tasks/{id}/approve` on Review Coordinator (or amend the spec + task list) | §2.3 | Small | ✅ resolved |
| 4 | Fix `serializeTask` fabricated `dueAt`; fix `500` on bad JSON + missing `force-dynamic` + unvalidated `params.id` in `workstreams/[id]/tasks` | §6.4–6.5 | Small | ✅ resolved |
| 5 | Land Task 5.1 integration tests against a real database — the only thing that can validate the atomic predicates this review could only read | §4.2 | Medium | ✅ landed & passing |

**Secondary (plan, don't block on):** ownership scoping for goals/tasks before multi-tenant use (§2.3.2), `goalDetailSchema` typing (§5), move offer expiry off the inbox GET (§3.3), set `REVIEW_COORDINATOR_USER_IDS` in the deployment environment.

### What this review could not verify

- ~~Runtime behavior against a real Postgres (no integration tests exist yet — Task 5.1).~~ **Now verified:** Task 5.1's suite (`src/__tests__/goals-lifecycle.e2e.test.ts`) runs against embedded PostgreSQL 18.4 with the schema provisioned from `prisma/schema.prisma`, and passes 19/19 including all three required edge cases. It never touches `.env` or the shared database.
- Migration health on the shared database (not touched, per repository rules). Note: the suite documents that `prisma migrate deploy` cannot replay onto a fresh database (both `20261020120000_add_agent_table` and `20261020163500_add_goals_workstreams_agents_comments` create `Agent`) — this is a real deploy-risk owned elsewhere; the suite provisions from the final schema instead.
- The redefined Task 5.2 checklist boxes in `doc/GOALS_TASKLIST.md` §2 are still stale (Epic 4/5 shown unchecked); whoever owns the task list should reconcile them with the detailed section.
