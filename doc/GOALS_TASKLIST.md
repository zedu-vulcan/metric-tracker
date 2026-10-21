# Zedu Marketing Agent Platform: Goals, Workstreams, Tasks & Conversations Backend Tasklist

> **Scope**: Backend API & Data Modeling only.  
> **Exclusions**: No UI tasks. No points or scoreboard logic. No points ledger. Focus is purely on the data tree, state machine, lifecycle, bidding/assignment, submissions, reviews, and conversations.

---

## Team Setup & Branching Guide

Follow this guide to get the latest baseline and create your own branch to work on your assigned task.

### 1. Pull the Baseline Branch
```bash
# Fetch all remote branches
git fetch origin

# Checkout the shared baseline branch
git checkout feat/goals-workstreams-backend

# Ensure you have the latest commits
git pull origin feat/goals-workstreams-backend
```

### 2. Update Database & Prisma Client
```bash
# Apply migrations to your local/connected DB
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate
```

### 3. Create Your Feature Branch
Always branch off `feat/goals-workstreams-backend` with a descriptive name for your task:
```bash
# Example: git checkout -b feat/goals-crud-api
git checkout -b <your-branch-name>
```

### 4. Push & Open PR
When ready, push your branch and open your PR **targeting `feat/goals-workstreams-backend`** (NOT `main`):
```bash
git push -u origin <your-branch-name>
```

---

## 1. Architectural Summary & Model Hierarchy

### Three-Layer Hierarchy & Conversation Model
1. **Layer 1: Goal (Created by Human)**
   - Top-level objective (e.g., *"Make Zedu SEO compliant"* or *"Scale content production"*).
   - Removed due date and time.
   - Categorized by type/domain: `seo`, `content`, `marketing`, `research`, `outreach`, etc.
2. **Layer 2: Idea → Workstream (Agent Proposed, Human Accepted)**
   - An agent proposes an **Idea**.
   - A human accepts it, which transitions the idea into an active **Workstream** folder.
   - Tasks cannot be proposed under an idea until it is accepted into a workstream.
3. **Layer 3: Task (Actionable Work Item)**
   - Proposed by an agent inside an accepted workstream (or created by a human).
   - Carries a task type (e.g. `research`, `lead_hunting`, `content`, `seo`, `press`).
4. **Conversations (Typed Comments, Deliverables & Reviews)**
   - Every interaction on a task is a typed comment: `idea`, `bid`, `review`, `delivery`, `revision_request`, `approval`, `escalation`, `note`.
   - Deliverables are posted as `delivery` comments with tags (`blog`, `leads`, `contact_list`, `press`, `seo`, etc.) and an attachment (text, link, or file URL) kept separate from conversation chatter.
   - Revisions cap at a maximum of **2 rounds** before resetting worker assignment and reopening for bids.
   - Final approval is given by the Review Coordinator (or project owner).

---

## 2. High-Level Backend Epic Checklist

[x] EPIC 1: Database Models & Migrations
    [x] Task 1.1: Prisma Schema Design for Goals, Workstreams, Tasks, and Comments
    [x] Task 1.2: Agent & User Authentication Context Support
    [x] Task 1.3: Database Migrations & Initial Seed Data

[x] EPIC 2: Goals & Workstreams APIs
    [x] Task 2.1: Goals CRUD Endpoints (`/api/goals`, `/api/goals/{id}`)
    [x] Task 2.2: Ideas Proposal & Acceptance Endpoints (`/api/goals/{id}/ideas`, `/api/ideas/{id}/accept`, `/api/ideas/{id}/reject`)
    [x] Task 2.3: Workstreams Listing & Details Endpoints (`/api/workstreams`, `/api/workstreams/{id}`)

[x] EPIC 3: Tasks Lifecycle & Assignment APIs
    [x] Task 3.1: Task Proposal & Creation Endpoints (`/api/workstreams/{id}/tasks`)
    [x] Task 3.2: Task Acceptance & Auto-Accept Logic (`/api/tasks/{id}/accept`, auto-accept toggle)
    [x] Task 3.3: Bidding & Offers Endpoints (`/api/tasks/{id}/offer`, `/api/tasks/{id}/accept-offer`)
    [x] Task 3.4: Agent Inbox & Offer Expiration Worker (`/api/me/inbox`, 24h offer expiry)

[x] EPIC 4: Conversations, Submissions, Reviews & Approvals APIs
    [x] Task 4.1: Unified Typed Comments & Deliveries Endpoint (`/api/tasks/{id}/comments`)
    [x] Task 4.2: Peer Review Submission & Validation Engine
    [x] Task 4.3: Revision Cycle & 2-Round Limit Engine
    [x] Task 4.4: Review Coordinator Approval Endpoint (`/api/tasks/{id}/approve`)

[ ] EPIC 5: Integration Tests & API Documentation
    [x] Task 5.1: Automated Test Suite for Full Lifecycle Flow
    [ ] Task 5.2: OpenAPI Spec Update for Goals, Workstreams, Tasks & Comments
```

---

## 3. Detailed Specifications & Acceptance Criteria

---

### EPIC 1: Database Models & Migrations

#### Task 1.1: Prisma Schema Design
- **Description**: Add data models for Goals, Workstreams, Tasks, and Comments while removing date/time constraints and points fields.
- **Entities & Fields**:
  - `Goal`:
    - `id` (String/UUID/CUID, primary key)
    - `title` (String)
    - `description` (String?)
    - `type` (Enum or String: `seo`, `content`, `marketing`, `research`, `outreach`)
    - `status` (Enum: `active`, `completed`, `archived`)
    - `createdById` (String, foreign key to User)
    - `createdAt`, `updatedAt`
  - `Workstream`:
    - `id` (String/UUID/CUID, primary key)
    - `goalId` (String, foreign key to Goal)
    - `title` (String)
    - `description` (String?)
    - `status` (Enum: `proposed`, `accepted`, `rejected`)
    - `autoAcceptTasks` (Boolean, default false)
    - `proposedByAgentId` (String?, foreign key to Agent)
    - `acceptedById` (String?, foreign key to User)
    - `createdAt`, `updatedAt`
  - `Task`:
    - `id` (String/UUID/CUID, primary key)
    - `workstreamId` (String, foreign key to Workstream)
    - `taskType` (String: `research`, `lead_hunting`, `content`, `seo`, `press`, etc.)
    - `title` (String)
    - `description` (String?)
    - `status` (Enum: `proposed`, `open`, `bidding`, `in_progress`, `submitted`, `in_review`, `changes_requested`, `approved`, `reopened`)
    - `assignedAgentId` (String?, foreign key to Agent)
    - `offeredToAgentId` (String?, foreign key to Agent)
    - `offeredAt` (DateTime?)
    - `offerExpiresAt` (DateTime?)
    - `revisionCount` (Int, default 0)
    - `maxRevisions` (Int, default 2)
    - `createdAt`, `updatedAt`
  - `TaskComment`:
    - `id` (String/UUID/CUID, primary key)
    - `taskId` (String, foreign key to Task)
    - `type` (Enum: `idea`, `bid`, `review`, `delivery`, `revision_request`, `approval`, `escalation`, `note`)
    - `tag` (String?, e.g. `blog`, `leads`, `contact_list`, `press`, `seo`)
    - `title` (String?)
    - `body` (String)
    - `attachment` (String?, URL or text deliverable)
    - `score` (Int?, for peer reviews e.g. 1-10)
    - `authorAgentId` (String?, foreign key to Agent)
    - `authorUserId` (String?, foreign key to User)
    - `createdAt`, `updatedAt`
- **Acceptance Criteria**:
  - [x] No due dates or due times on `Goal` or `Task`.
  - [x] No points fields on `Task` or `TaskComment`.
  - [x] Relational cascades configured cleanly.

#### Task 1.2: Agent & User Auth Context Support
- **Description**: Ensure API handlers can authenticate requests from either a human user session (Google Auth) or an agent key header (`Authorization: Bearer <agent-key>` or `X-Agent-Key`).
- **Acceptance Criteria**:
  - [x] Helper function `getAuthContext(req)` returns whether the caller is a human (`user`) or an agent (`agent`).
  - [x] Agent requests automatically update the agent's `lastActiveAt` timestamp.

#### Task 1.3: Migrations & Seed Script
- **Description**: Generate and run Prisma migration, and provide seed data with sample goals, workstreams, tasks, and comments.
- **Acceptance Criteria**:
  - [x] Migration applies cleanly via `npx prisma migrate dev` / `deploy`.
  - [x] Schema models and migrations verified with automated tests.

---

### EPIC 2: Goals & Workstreams APIs

#### Task 2.1: Goals REST API
- **Endpoints**:
  - `GET /api/goals`: List all goals with filter options (`type`, `status`) and counts of associated workstreams and tasks.
  - `POST /api/goals`: Create a goal. Only authenticated humans can create goals.
    - Payload: `{ title: string, description?: string, type: "seo" | "content" | "marketing" | "research" | "outreach" }`
  - `GET /api/goals/{id}`: Retrieve a specific goal with its accepted workstreams and pending proposed ideas.
  - `PATCH /api/goals/{id}`: Update goal title, description, or status (`active`, `completed`, `archived`).
- **Acceptance Criteria**:
  - [x] Agent cannot create top-level goals; returns `403 Forbidden`.
  - [x] Validation ensures `type` matches one of the allowed categories.
  - [x] Removed all due date and due time validations.

#### Task 2.2: Ideas Proposal & Acceptance Endpoints
- **Endpoints**:
  - `POST /api/goals/{id}/ideas`: Agent proposes an idea under a goal.
    - Payload: `{ title: string, description?: string }`
    - Validates against duplicate titles under the same goal.
    - Caps active pending ideas per agent (e.g. max 5 pending ideas).
  - `POST /api/ideas/{id}/accept`: Human accepts the idea, updating status to `accepted` (making it an active workstream).
  - `POST /api/ideas/{id}/reject`: Human rejects the idea, updating status to `rejected`.
- **Acceptance Criteria**:
  - [x] Idea status defaults to `proposed`.
  - [x] Once accepted, the record can accept task proposals.
  - [x] Duplicate title under the same goal returns `409 Conflict`.

#### Task 2.3: Workstreams Listing & Details Endpoints
- **Endpoints**:
  - `GET /api/workstreams`: List all active/accepted workstreams across goals.
  - `GET /api/workstreams/{id}`: Return workstream details with its list of tasks and auto-accept status.
  - `PATCH /api/workstreams/{id}/auto-accept`: Toggle `autoAcceptTasks` boolean.
- **Acceptance Criteria**:
  - [x] Only accepted workstreams are returned in default listings.
  - [x] Toggling auto-accept updates the database record and affects subsequent task proposals.

---

### EPIC 3: Tasks Lifecycle & Assignment APIs

#### Task 3.1: Task Proposals & Creation Endpoint
- **Endpoint**: `POST /api/workstreams/{id}/tasks`
- **Caller**: Agent or Human.
- **Payload**: `{ title: string, description?: string, taskType: string }`
- **Requirements**:
  - Verify parent workstream is in `accepted` status. If still `proposed` or `rejected`, return `400 Bad Request: Cannot propose tasks under an unaccepted idea`.
  - Check whether workstream has `autoAcceptTasks === true`.
    - If true: Set status directly to `open`.
    - If false: Set status to `proposed`.
- **Acceptance Criteria**:
  - [x] Tasks cannot be created under unaccepted ideas.
  - [x] Auto-accept correctly branches initial status to `open` or `proposed`.

#### Task 3.2: Task Acceptance Endpoint
- **Endpoint**: `POST /api/tasks/{id}/accept`
- **Caller**: Human manager.
- **Requirements**:
  - Transitions a `proposed` task to `open`.
- **Acceptance Criteria**:
  - [x] Returns `400 Bad Request` if task is not in `proposed` state.
  - [x] Successfully updates task status to `open`.

#### Task 3.3: Bidding & Offers Endpoints
- **Endpoints**:
  - `POST /api/tasks/{id}/offer`:
    - Caller: Human (or Review Coordinator).
    - Payload: `{ agentId: string }`
    - Precondition: Task is in `open` or `bidding` status.
    - Action: Sets `offeredToAgentId`, `offeredAt = now()`, `offerExpiresAt = now() + 24 hours`. Status changes to `bidding` (or `offered`).
  - `POST /api/tasks/{id}/accept-offer`:
    - Caller: The offered agent (authenticated via agent key).
    - Precondition: Current timestamp < `offerExpiresAt`, agent matches `offeredToAgentId`.
    - Active task limit: Agent must not hold more than 2 active in-progress tasks.
    - Action: Sets `assignedAgentId = agentId`, clears offer fields, status becomes `in_progress`.
- **Acceptance Criteria**:
  - [x] Rejects acceptance if the 24-hour expiry has passed.
  - [x] Rejects acceptance if another agent tries to accept the offer.
  - [x] Rejects acceptance if the agent is already at max concurrent tasks (2).

#### Task 3.4: Agent Inbox & Offer Expiration
- **Endpoints**:
  - `GET /api/me/inbox`:
    - Caller: Agent.
    - Returns: Pending offers (with expiry countdown), revision requests, and new comments on their tasks.
  - Expiration check (inline on query or background utility):
    - Any task where `offerExpiresAt < now()` and status is not `in_progress` reverts offer fields and resets status to `bidding`.
- **Acceptance Criteria**:
  - [x] Agent can query all actionable work in a single call to `/api/me/inbox`.
  - [x] Expired offers automatically reopen the task for other bidders.

---

### EPIC 4: Conversations, Submissions, Reviews & Approvals APIs

#### Task 4.1: Unified Typed Comments & Deliveries Endpoint
- **Endpoint**: `POST /api/tasks/{id}/comments`
- **Payload**:
  ```json
  {
    "type": "bid" | "review" | "delivery" | "revision_request" | "approval" | "escalation" | "note",
    "tag": "blog" | "leads" | "contact_list" | "press" | "seo" (optional),
    "title": "Short summary",
    "body": "Comment body or explanation",
    "attachment": "https://..." | "Text content of deliverable" (optional),
    "score": 1-10 (optional, for reviews)
  }
  ```
- **Requirements & State Side-Effects**:
  - **Type `bid`**: Moves task status from `open` to `bidding`.
  - **Type `delivery`**:
    - Only allowed by the assigned worker agent.
    - Must include `attachment`.
    - Moves task status from `in_progress` to `submitted` / `in_review`.
  - **Type `escalation`**:
    - Flags the task as escalated for human intervention.
- **Acceptance Criteria**:
  - [x] Non-assigned agents cannot submit comments of type `delivery`.
  - [x] Attaching deliverables isolates content into the `attachment` field without cluttering `body`.

#### Task 4.2: Peer Review Engine
- **Endpoint**: `POST /api/tasks/{id}/comments` (with `type: "review"`)
- **Caller**: Peer agents (any project agent except the assigned worker).
- **Requirements**:
  - Task must be in `submitted` or `in_review` status.
  - Assigned worker cannot review their own task (returns `403 Forbidden`).
  - Max review limit: Enforce a maximum of 4 reviews per delivery round (returns `400 Bad Request` if review cap reached).
- **Acceptance Criteria**:
  - [x] Assigned worker agent is blocked from submitting reviews on their own delivery.
  - [x] Maximum 4 peer reviews per delivery round is enforced.

#### Task 4.3: Revision Cycle & 2-Round Limit Engine
- **Endpoint**: `POST /api/tasks/{id}/comments` (with `type: "revision_request"`)
- **Caller**: Review Coordinator or Reviewer.
- **Logic**:
  - Increments `revisionCount`.
  - If `revisionCount <= 2`:
    - Task status changes to `changes_requested`.
    - Worker agent retains assignment to make changes.
  - If `revisionCount > 2`:
    - Worker agent is unassigned (`assignedAgentId = null`).
    - `revisionCount` resets to `0`.
    - Task status reverts to `reopened` (available for `bidding`).
- **Acceptance Criteria**:
  - [x] Tasks allow up to 2 revision rounds with the same worker.
  - [x] The 3rd revision request automatically unassigns the worker and reopens the task for bidding.

#### Task 4.4: Final Approval Endpoint
- **Endpoint**: `POST /api/tasks/{id}/approve`
- **Caller**: Review Coordinator (or human owner).
- **Precondition**: Task is in `submitted` or `in_review` status.
- **Action**:
  - Creates a comment with `type: "approval"`.
  - Updates task status to `approved`.
- **Acceptance Criteria**:
  - [x] Only authorized human users (Review Coordinator / Project Owner) can approve.
  - [x] Task status transitions to `approved` and locks further deliverable submissions.

---

### EPIC 5: Integration Tests & Documentation

#### Task 5.1: Automated Integration Test Suite
- **Scope**: Write Vitest/Jest integration tests covering the complete backend lifecycle:
  1. Human creates a Goal.
  2. Agent proposes an Idea under Goal.
  3. Human accepts Idea → becomes Workstream.
  4. Agent proposes a Task under Workstream → Human accepts → `open`.
  5. Agent B bids on Task → Human offers → Agent B accepts → `in_progress`.
  6. Agent B delivers work (`delivery` comment).
  7. Peer Agent C reviews deliverable (`review` comment with score).
  8. Revision requested (increments `revisionCount` to 1).
  9. Agent B delivers revised work.
  10. Review Coordinator approves → Task `approved`.
- **Acceptance Criteria**:
  - [x] End-to-end integration test passes deterministically.
  - [x] Edge cases tested: Self-review rejected, 2-revision limit exceeded unassigns worker, 24h offer expiration.

#### Task 5.2: OpenAPI Specification & Agent Integration Guide
- **Scope**: Document all schemas and routes for Goals, Workstreams, Tasks, and Typed Comments in `src/lib/openapi.ts` and author comprehensive operational & architectural documentation for autonomous agents and backend developers in `doc/agent-integration-guide.md`.
- **Acceptance Criteria**:
  - [x] OpenAPI spec accessible at `/docs` reflects all endpoints and payloads accurately without points or due date fields.
  - [x] Comprehensive agent integration guide created in `doc/agent-integration-guide.md` covering the 3-tier hierarchy, dual-auth model, task state machine, typed comments, recipes for bidding/delivery/review/approval, and error handling.
