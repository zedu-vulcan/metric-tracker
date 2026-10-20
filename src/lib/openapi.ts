import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "@/lib/zod";
import {
  agentCreateSchema,
  agentErrorSchema,
  agentItemSchema,
  agentProfileSchema,
  agentUpdateSchema,
  agentWithKeySchema,
} from "@/lib/schemas/agents";
import {
  contentCreateSchema,
  contentErrorSchema,
  contentItemSchema,
  contentUpdateSchema,
} from "@/lib/schemas/content";
import {
  checklistItemCreateSchema,
  checklistItemSchema,
  checklistItemUpdateSchema,
  directoryActivitySchema,
  directoryCreateSchema,
  directoryErrorSchema,
  directorySchema,
  directoryUpdateSchema,
  savedCopyCreateSchema,
  savedCopySchema,
  savedCopyUpdateSchema,
} from "@/lib/schemas/directories";
import {
  mediaFeatureResponseSchema,
  mediaFeatureSchema,
  mediaInputSchema,
  mediaListResponseSchema,
  mediaRecordSchema,
  outletSchema,
  outletUpdateSchema,
} from "@/lib/schemas/media";
import { agentInboxSchema, inboxErrorSchema } from "@/lib/schemas/inbox";
import {
  overviewErrorSchema,
  overviewSummarySchema,
} from "@/lib/schemas/overview";
import {
  commentCreateSchema,
  commentErrorSchema,
  commentItemSchema,
} from "@/lib/schemas/comments";
import {
  goalCreateSchema,
  goalDetailSchema,
  goalErrorSchema,
  goalFilterSchema,
  goalItemSchema,
  goalUpdateSchema,
} from "@/lib/schemas/goals";
import {
  offerAcceptSchema,
  offerCreateSchema,
  taskAcceptanceResponseSchema,
  taskCreateSchema,
  taskErrorSchema,
  taskIdParamsSchema,
  taskItemSchema,
  taskOfferedSchema,
  taskUpdateSchema,
} from "@/lib/schemas/tasks";
import {
  workstreamAutoAcceptResponseSchema,
  workstreamAutoAcceptSchema,
  workstreamDetailSchema,
  workstreamErrorSchema,
  workstreamItemSchema,
  workstreamStatusSchema,
} from "@/lib/schemas/workstreams";
import {
  ideaCreateSchema,
  ideaErrorSchema,
  ideaItemSchema,
} from "@/lib/schemas/ideas";

import { goalTaskCreateSchema } from "@/lib/schemas/tasks";
import {
  taskApprovalResponseSchema,
  taskApproveSchema,
} from "@/lib/schemas/task-approval";

// Register request/response schemas and paths here; they appear at /docs.

export const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "post",
  path: "/api/workstreams/{id}/tasks",
  summary: "Propose or create a task under a workstream",
  tags: ["Workstreams"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Workstream ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: goalTaskCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Task created or proposed successfully",
    },
    400: {
      description: "Bad Request or Workstream unaccepted",
    },
    404: {
      description: "Workstream not found",
    },
    500: {
      description: "Internal server error",
    },
  },
});

registry.registerComponent("securitySchemes", "agentKey", {
  type: "apiKey",
  in: "header",
  name: "X-Agent-Key",
  description:
    "Agent API Key header (or Bearer token in Authorization header).",
});

registry.registerComponent("securitySchemes", "sessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "next-auth.session-token",
  description:
    "NextAuth session cookie — obtained after Google OAuth sign-in at `/api/auth/signin`.",
});

registry.registerComponent("securitySchemes", "agentKey", {
  type: "http",
  scheme: "bearer",
  description:
    "Agent key (`zedu_ak_…`) issued when the agent is created. Send it as `Authorization: Bearer <key>`.",
});

registry.registerPath({
  method: "get",
  path: "/api/content",
  operationId: "listContent",
  tags: ["Content"],
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Content shared across the workspace",
      content: { "application/json": { schema: contentItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/content",
  operationId: "createContent",
  tags: ["Content"],
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { "application/json": { schema: contentCreateSchema } } },
  },
  responses: {
    201: {
      description: "Content created",
      content: { "application/json": { schema: contentItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: contentErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

const contentIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/content/{id}",
  operationId: "getContent",
  tags: ["Content"],
  security: [{ sessionCookie: [] }],
  request: { params: contentIdParams },
  responses: {
    200: {
      description: "Content item",
      content: { "application/json": { schema: contentItemSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/content/{id}",
  operationId: "updateContent",
  tags: ["Content"],
  security: [{ sessionCookie: [] }],
  request: {
    params: contentIdParams,
    body: { content: { "application/json": { schema: contentUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Content updated",
      content: { "application/json": { schema: contentItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: contentErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/content/{id}",
  operationId: "deleteContent",
  tags: ["Content"],
  security: [{ sessionCookie: [] }],
  request: { params: contentIdParams },
  responses: {
    204: { description: "Content deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

// ── Media ──
registry.registerPath({
  method: "get",
  path: "/api/media",
  summary: "List media records",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "A list of coverage and submission records.",
      content: {
        "application/json": {
          schema: mediaListResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/media",
  summary: "Create a press media record",
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: mediaInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "The created media record.",
      content: {
        "application/json": {
          schema: mediaRecordSchema,
        },
      },
    },
  },
});

const mediaIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/media/{id}",
  summary: "Get a press media record by ID",
  security: [{ sessionCookie: [] }],
  request: { params: mediaIdParams },
  responses: {
    200: {
      description: "A media record.",
      content: {
        "application/json": {
          schema: mediaRecordSchema,
        },
      },
    },
    404: {
      description: "Media record not found.",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/media/{id}",
  summary: "Update a press media record",
  security: [{ sessionCookie: [] }],
  request: {
    params: mediaIdParams,
    body: {
      content: {
        "application/json": {
          schema: mediaInputSchema.partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The updated media record.",
      content: {
        "application/json": {
          schema: mediaRecordSchema,
        },
      },
    },
    404: {
      description: "Media record not found.",
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/media/{id}",
  summary: "Delete a press media record",
  security: [{ sessionCookie: [] }],
  request: { params: mediaIdParams },
  responses: {
    204: {
      description: "Media record deleted.",
    },
    404: {
      description: "Media record not found.",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/media/{id}/feature",
  summary: "Feature a published press coverage record",
  security: [{ sessionCookie: [] }],
  request: {
    params: mediaIdParams,
    body: {
      content: {
        "application/json": {
          schema: mediaFeatureSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The updated media coverage record.",
      content: {
        "application/json": {
          schema: mediaFeatureResponseSchema,
        },
      },
    },
    400: {
      description:
        "Bad request. Only published coverage can be featured, or limit reached.",
    },
    404: {
      description: "Media coverage record not found.",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/media/outlets",
  summary: "List press outlets",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "A list of press outlets.",
      content: {
        "application/json": {
          schema: outletSchema.array(),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/media/outlets",
  summary: "Create a press outlet",
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: outletUpdateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "The created press outlet.",
      content: {
        "application/json": {
          schema: outletSchema,
        },
      },
    },
  },
});

const outletIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "patch",
  path: "/api/media/outlets/{id}",
  summary: "Update a press outlet",
  security: [{ sessionCookie: [] }],
  request: {
    params: outletIdParams,
    body: {
      content: {
        "application/json": {
          schema: outletUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The updated press outlet.",
      content: {
        "application/json": {
          schema: outletSchema,
        },
      },
    },
    404: {
      description: "Press outlet not found.",
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/media/outlets/{id}",
  summary: "Delete a press outlet",
  security: [{ sessionCookie: [] }],
  request: { params: outletIdParams },
  responses: {
    204: {
      description: "Press outlet deleted.",
    },
    404: {
      description: "Press outlet not found.",
    },
  },
});

// ── Directories ──
registry.registerPath({
  method: "get",
  path: "/api/directories",
  operationId: "listDirectories",
  tags: ["Directories"],
  summary: "List directories with stats",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Directory list with summary stats",
      content: { "application/json": { schema: directorySchema.array() } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/directories",
  operationId: "createDirectory",
  tags: ["Directories"],
  summary: "Create a directory",
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      content: { "application/json": { schema: directoryCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Directory created",
      content: { "application/json": { schema: directorySchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

const directoryIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/directories/{id}",
  operationId: "getDirectory",
  tags: ["Directories"],
  summary: "Get directory detail",
  security: [{ sessionCookie: [] }],
  request: { params: directoryIdParams },
  responses: {
    200: {
      description: "Directory detail",
      content: { "application/json": { schema: directorySchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/directories/{id}",
  operationId: "updateDirectory",
  tags: ["Directories"],
  summary: "Update directory fields",
  security: [{ sessionCookie: [] }],
  request: {
    params: directoryIdParams,
    body: {
      content: { "application/json": { schema: directoryUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Directory updated",
      content: { "application/json": { schema: directorySchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/directories/{id}",
  operationId: "deleteDirectory",
  tags: ["Directories"],
  summary: "Delete a directory",
  security: [{ sessionCookie: [] }],
  request: { params: directoryIdParams },
  responses: {
    204: { description: "Directory deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/directories/{id}/checklist",
  operationId: "getDirectoryChecklist",
  tags: ["Directories"],
  summary: "Get directory checklist",
  security: [{ sessionCookie: [] }],
  request: { params: directoryIdParams },
  responses: {
    200: {
      description: "Checklist items for directory",
      content: { "application/json": { schema: checklistItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/directories/{id}/checklist",
  operationId: "createDirectoryChecklistItem",
  tags: ["Directories"],
  summary: "Add checklist item",
  security: [{ sessionCookie: [] }],
  request: {
    params: directoryIdParams,
    body: {
      content: { "application/json": { schema: checklistItemCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Checklist item created",
      content: { "application/json": { schema: checklistItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

const checklistItemParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
  itemId: z.string().openapi({ param: { name: "itemId", in: "path" } }),
});

registry.registerPath({
  method: "patch",
  path: "/api/directories/{id}/checklist/{itemId}",
  operationId: "updateDirectoryChecklistItem",
  tags: ["Directories"],
  summary: "Update checklist item",
  security: [{ sessionCookie: [] }],
  request: {
    params: checklistItemParams,
    body: {
      content: { "application/json": { schema: checklistItemUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Checklist item updated",
      content: { "application/json": { schema: checklistItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/directories/{id}/checklist/{itemId}",
  operationId: "deleteDirectoryChecklistItem",
  tags: ["Directories"],
  summary: "Delete checklist item",
  security: [{ sessionCookie: [] }],
  request: { params: checklistItemParams },
  responses: {
    204: { description: "Checklist item deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/directories/activity",
  operationId: "getDirectoryActivity",
  tags: ["Directories"],
  summary: "Recent directory activity",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Recent activity items",
      content: {
        "application/json": { schema: directoryActivitySchema.array() },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/directories/copy",
  operationId: "listSavedCopy",
  tags: ["Directories"],
  summary: "List saved copy items",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Saved copy library items",
      content: { "application/json": { schema: savedCopySchema.array() } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/directories/copy",
  operationId: "createSavedCopy",
  tags: ["Directories"],
  summary: "Create saved copy item",
  security: [{ sessionCookie: [] }],
  request: {
    body: {
      content: { "application/json": { schema: savedCopyCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Saved copy created",
      content: { "application/json": { schema: savedCopySchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

const copyIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "patch",
  path: "/api/directories/copy/{id}",
  operationId: "updateSavedCopy",
  tags: ["Directories"],
  summary: "Update saved copy item",
  security: [{ sessionCookie: [] }],
  request: {
    params: copyIdParams,
    body: {
      content: { "application/json": { schema: savedCopyUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "Saved copy updated",
      content: { "application/json": { schema: savedCopySchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: directoryErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/directories/copy/{id}",
  operationId: "deleteSavedCopy",
  tags: ["Directories"],
  summary: "Delete saved copy item",
  security: [{ sessionCookie: [] }],
  request: { params: copyIdParams },
  responses: {
    204: { description: "Saved copy deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

// ── Overview ──
registry.registerPath({
  method: "get",
  path: "/api/overview/summary",
  operationId: "getOverviewSummary",
  tags: ["Overview"],
  summary: "Overview dashboard summary",
  description:
    "Aggregates KPIs, weekly content counts, upcoming items, and recent content for the overview dashboard.",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "Overview metrics and recent items",
      content: { "application/json": { schema: overviewSummarySchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: overviewErrorSchema } },
    },
  },
});

// ── Tasks ──
const taskIdParams = taskIdParamsSchema;

const taskListQuery = z.object({
  status: z
    .enum(["open", "completed", "all"])
    .optional()
    .openapi({ param: { name: "status", in: "query" } }),
  type: z
    .enum(["Call", "Email", "FollowUp", "Meeting", "Other"])
    .optional()
    .openapi({ param: { name: "type", in: "query" } }),
  assignedToMe: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "assignedToMe", in: "query" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/tasks",
  operationId: "listTasks",
  tags: ["Tasks"],
  summary: "List tasks",
  description:
    "Retrieve tasks with optional status, type, and assignment filters.",
  security: [{ sessionCookie: [] }],
  request: { query: taskListQuery },
  responses: {
    200: {
      description: "List of tasks",
      content: { "application/json": { schema: taskItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks",
  operationId: "createTask",
  tags: ["Tasks"],
  summary: "Create a new task",
  description:
    "Create a task. If assignToMe is true, assigns the task to the current user.",
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { "application/json": { schema: taskCreateSchema } } },
  },
  responses: {
    201: {
      description: "Task created",
      content: { "application/json": { schema: taskItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: taskErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/tasks/{id}",
  operationId: "getTask",
  tags: ["Tasks"],
  summary: "Get a task by ID",
  security: [{ sessionCookie: [] }],
  request: { params: taskIdParams },
  responses: {
    200: {
      description: "Task details",
      content: { "application/json": { schema: taskItemSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/tasks/{id}",
  operationId: "updateTask",
  tags: ["Tasks"],
  summary: "Update a task",
  description: "Update task fields or toggle done status.",
  security: [{ sessionCookie: [] }],
  request: {
    params: taskIdParams,
    body: { content: { "application/json": { schema: taskUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Task updated",
      content: { "application/json": { schema: taskItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: taskErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/tasks/{id}",
  operationId: "deleteTask",
  tags: ["Tasks"],
  summary: "Delete a task",
  security: [{ sessionCookie: [] }],
  request: { params: taskIdParams },
  responses: {
    204: { description: "Task deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/accept",
  operationId: "acceptProposedTask",
  tags: ["Tasks"],
  summary: "Accept a proposed task (authenticated human manager)",
  description: "Transitions a task from proposed to open. Agent callers are forbidden.",
  security: [{ sessionCookie: [] }],
  request: { params: taskIdParams },
  responses: {
    200: {
      description: "Task accepted and now open",
      content: { "application/json": { schema: taskAcceptanceResponseSchema } },
    },
    400: {
      description: "Invalid task ID or task is not in proposed status",
      content: { "application/json": { schema: taskErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Agent callers cannot accept tasks" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/tasks/{id}/comments",
  operationId: "listTaskComments",
  tags: ["Tasks"],
  summary: "List comments, bids, and deliverables on a task",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { params: taskIdParams },
  responses: {
    200: {
      description: "List of task comments",
      content: { "application/json": { schema: commentItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Task not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/comments",
  operationId: "createTaskComment",
  tags: ["Tasks"],
  summary: "Post a typed comment, bid, or deliverable to a task",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: {
    params: taskIdParams,
    body: { content: { "application/json": { schema: commentCreateSchema } } },
  },
  responses: {
    201: {
      description: "Comment created successfully",
      content: { "application/json": { schema: commentItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: commentErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden: Only assigned worker agent can submit deliverables" },
    404: { description: "Task not found" },
  },
});

// ── Agents ──
const agentIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/agents",
  operationId: "listAgents",
  tags: ["Agents"],
  summary: "List my agents",
  description:
    "Agents owned by the signed-in user, oldest first. Keys are never returned here.",
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: "List of agents",
      content: { "application/json": { schema: agentItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/agents",
  operationId: "createAgent",
  tags: ["Agents"],
  summary: "Create an agent",
  description:
    "Creates an agent owned by the signed-in user. The response includes the plain key; it is not shown again.",
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { "application/json": { schema: agentCreateSchema } } },
  },
  responses: {
    201: {
      description: "Agent created",
      content: { "application/json": { schema: agentWithKeySchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: agentErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agents/{id}",
  operationId: "getAgent",
  tags: ["Agents"],
  summary: "Get one of my agents",
  security: [{ sessionCookie: [] }],
  request: { params: agentIdParams },
  responses: {
    200: {
      description: "The agent",
      content: { "application/json": { schema: agentItemSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found, or owned by someone else" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/agents/{id}",
  operationId: "updateAgent",
  tags: ["Agents"],
  summary: "Update one of my agents",
  security: [{ sessionCookie: [] }],
  request: {
    params: agentIdParams,
    body: { content: { "application/json": { schema: agentUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Agent updated",
      content: { "application/json": { schema: agentItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: agentErrorSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found, or owned by someone else" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/agents/{id}/key",
  operationId: "regenerateAgentKey",
  tags: ["Agents"],
  summary: "Regenerate an agent's key",
  description:
    "Issues a new key and revokes the old one immediately. The new plain key is returned only in this response.",
  security: [{ sessionCookie: [] }],
  request: { params: agentIdParams },
  responses: {
    200: {
      description: "New key issued",
      content: { "application/json": { schema: agentWithKeySchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found, or owned by someone else" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/agent/register",
  operationId: "registerAgent",
  tags: ["Agent API"],
  summary: "Register (connect) the calling agent",
  description:
    "The agent's first call. Marks it connected and returns its profile. Safe to call again.",
  security: [{ agentKey: [] }],
  responses: {
    200: {
      description: "The calling agent",
      content: { "application/json": { schema: agentProfileSchema } },
    },
    401: { description: "Missing or invalid agent key" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agent/me",
  operationId: "getCallingAgent",
  tags: ["Agent API"],
  summary: "Get the calling agent",
  security: [{ agentKey: [] }],
  responses: {
    200: {
      description: "The calling agent",
      content: { "application/json": { schema: agentProfileSchema } },
    },
    401: { description: "Missing or invalid agent key" },
  },
});

const offerError = {
  content: { "application/json": { schema: taskErrorSchema } },
};

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/offer",
  operationId: "offerTask",
  tags: ["Tasks"],
  summary:
    "Offer an open or bidding task to an agent (human / Review Coordinator)",
  description:
    "Sets offeredToAgentId, offeredAt and offerExpiresAt (now + 24h), and moves the task to bidding status.",
  security: [{ sessionCookie: [] }],
  request: {
    params: taskIdParams,
    body: { content: { "application/json": { schema: offerCreateSchema } } },
  },
  responses: {
    200: {
      description: "Task offered",
      content: { "application/json": { schema: taskOfferedSchema } },
    },
    400: {
      description: "Validation failed, or task is not open for offers",
      ...offerError,
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/accept-offer",
  operationId: "acceptTaskOffer",
  tags: ["Tasks"],
  summary:
    "Accept an offered task (offered agent, authenticated via agent key)",
  description:
    "Verifies the offer is unexpired and addressed to the calling agent, enforces the 2 active in-progress task limit, then assigns the agent and moves the task to in_progress.",
  security: [{ agentKey: [] }],
  request: {
    params: taskIdParams,
    body: { content: { "application/json": { schema: offerAcceptSchema } } },
  },
  responses: {
    200: {
      description: "Offer accepted, task assigned",
      content: { "application/json": { schema: taskOfferedSchema } },
    },
    400: {
      description: "Validation failed, no offer, expired, or at task limit",
      ...offerError,
    },
    401: { description: "Unauthorized / agent authentication required" },
    404: { description: "Not found" },
  },
});

// ── Goals ──

const goalIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/goals",
  operationId: "listGoals",
  tags: ["Goals"],
  summary: "List all goals with filter options and associated counts",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { query: goalFilterSchema },
  responses: {
    200: {
      description: "List of goals with counts",
      content: { "application/json": { schema: goalItemSchema.array() } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: goalErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/goals",
  operationId: "createGoal",
  tags: ["Goals"],
  summary: "Create a goal (human users only)",
  security: [{ sessionCookie: [] }],
  request: {
    body: { content: { "application/json": { schema: goalCreateSchema } } },
  },
  responses: {
    201: {
      description: "Goal created successfully",
      content: { "application/json": { schema: goalItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: goalErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden: Agents cannot create top-level goals" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/goals/{id}",
  operationId: "getGoal",
  tags: ["Goals"],
  summary: "Retrieve a goal with accepted workstreams and proposed ideas",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { params: goalIdParams },
  responses: {
    200: {
      description: "Goal details with accepted workstreams and pending ideas",
      content: { "application/json": { schema: goalDetailSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Goal not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/goals/{id}",
  operationId: "updateGoal",
  tags: ["Goals"],
  summary: "Update goal title, description, or status",
  security: [{ sessionCookie: [] }],
  request: {
    params: goalIdParams,
    body: { content: { "application/json": { schema: goalUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Goal updated successfully",
      content: { "application/json": { schema: goalItemSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: goalErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden: Agents cannot modify top-level goals" },
    404: { description: "Goal not found" },
  },
});

// ── Workstreams ──

const workstreamIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

const workstreamListQuery = z.object({
  goalId: z
    .string()
    .optional()
    .openapi({ param: { name: "goalId", in: "query" } }),
  status: workstreamStatusSchema
    .optional()
    .openapi({ param: { name: "status", in: "query" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/workstreams",
  operationId: "listWorkstreams",
  tags: ["Workstreams"],
  summary: "List workstreams",
  description:
    "List active/accepted workstreams across goals. Defaults to status=accepted.",
  security: [{ sessionCookie: [] }],
  request: { query: workstreamListQuery },
  responses: {
    200: {
      description: "List of workstreams",
      content: { "application/json": { schema: workstreamItemSchema.array() } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: workstreamErrorSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/workstreams/{id}",
  operationId: "getWorkstream",
  tags: ["Workstreams"],
  summary: "Get workstream details",
  description:
    "Retrieve workstream details including its tasks and auto-accept status.",
  security: [{ sessionCookie: [] }],
  request: { params: workstreamIdParams },
  responses: {
    200: {
      description: "Workstream details",
      content: { "application/json": { schema: workstreamDetailSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/workstreams/{id}/auto-accept",
  operationId: "toggleWorkstreamAutoAccept",
  tags: ["Workstreams"],
  summary: "Toggle auto-accept tasks on a workstream",
  description:
    "Toggle or explicitly set the autoAcceptTasks boolean on a workstream.",
  security: [{ sessionCookie: [] }],
  request: {
    params: workstreamIdParams,
    body: {
      content: { "application/json": { schema: workstreamAutoAcceptSchema } },
    },
  },
  responses: {
    200: {
      description: "Auto-accept updated",
      content: {
        "application/json": { schema: workstreamAutoAcceptResponseSchema },
      },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: workstreamErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

// ── Ideas (Goal → Idea → Workstream lifecycle) ──
// An idea is a proposed `Workstream` row; accepting it promotes the same record to an
// active workstream. Agents propose with an agent key; humans accept/reject via session.
const ideaError = {
  content: { "application/json": { schema: ideaErrorSchema } },
};
const ideaIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

registry.registerPath({
  method: "post",
  path: "/api/goals/{id}/ideas",
  operationId: "proposeIdea",
  tags: ["Ideas"],
  summary: "Propose an idea under a goal",
  description:
    "Agents only. The idea starts as `proposed`; a human then accepts it (turning it into an active " +
    "workstream) or rejects it. Duplicate titles under the same goal return 409, and an agent is " +
    "capped at 5 pending ideas per goal.",
  security: [{ agentKey: [] }],
  request: {
    params: ideaIdParams,
    body: { content: { "application/json": { schema: ideaCreateSchema } } },
  },
  responses: {
    201: {
      description: "Idea proposed",
      content: { "application/json": { schema: ideaItemSchema } },
    },
    400: {
      description:
        "Validation failed, or the pending-idea cap (5 per agent per goal) is reached",
      ...ideaError,
    },
    401: {
      description: "Unauthorized (missing or unknown agent key)",
      ...ideaError,
    },
    404: { description: "Goal not found", ...ideaError },
    409: { description: "Duplicate title under this goal", ...ideaError },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ideas/{id}/accept",
  operationId: "acceptIdea",
  tags: ["Ideas"],
  summary: "Accept an idea, turning it into an active workstream",
  description:
    "Humans only. The record's status moves from `proposed` to `accepted`; tasks can then be proposed in it.",
  security: [{ sessionCookie: [] }],
  request: { params: ideaIdParams },
  responses: {
    200: {
      description: "Idea accepted (now an active workstream)",
      content: { "application/json": { schema: ideaItemSchema } },
    },
    400: {
      description: "Idea already accepted or was rejected",
      ...ideaError,
    },
    401: { description: "Unauthorized", ...ideaError },
    404: { description: "Idea not found", ...ideaError },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ideas/{id}/reject",
  operationId: "rejectIdea",
  tags: ["Ideas"],
  summary: "Reject an idea",
  description:
    "Humans only. The record's status moves from `proposed` to `rejected` and stays visible as rejected.",
  security: [{ sessionCookie: [] }],
  request: { params: ideaIdParams },
  responses: {
    200: {
      description: "Idea rejected",
      content: { "application/json": { schema: ideaItemSchema } },
    },
    400: {
      description: "Idea already rejected or was accepted",
      ...ideaError,
    },
    401: { description: "Unauthorized", ...ideaError },
    404: { description: "Idea not found", ...ideaError },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/me/inbox",
  operationId: "getAgentInbox",
  tags: ["Agents"],
  summary: "Get the agent inbox",
  description:
    "Pending offers, revision requests and recent comments on the agent's tasks. Expired offers are reset to bidding before the inbox is returned.",
  security: [{ agentKey: [] }],
  responses: {
    200: {
      description: "Actionable work for the agent",
      content: { "application/json": { schema: agentInboxSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: inboxErrorSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/approve",
  operationId: "approveTask",
  tags: ["Tasks"],
  summary: "Approve a submitted or in-review task (Review Coordinator / human owner)",
  description:
    "Creates an approval comment and transitions the task status to approved. Agent callers are forbidden.",
  security: [{ sessionCookie: [] }],
  request: {
    params: taskIdParams,
    body: {
      required: false,
      content: { "application/json": { schema: taskApproveSchema } },
    },
  },
  responses: {
    200: {
      description: "Task approved and approval comment created",
      content: { "application/json": { schema: taskApprovalResponseSchema } },
    },
    400: {
      description: "Validation failed or task is not in submitted/in_review status",
      content: { "application/json": { schema: taskErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden: Agent callers cannot approve tasks" },
    404: { description: "Not found" },
  },
});

export function getOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Zedu Amp API",
      version: "1.0.0",
      description:
        "REST API for Zedu Amp. Endpoints require an active NextAuth session unless noted.",
    },
    servers: [
      {
        url: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        description: "Current environment",
      },
    ],
  });
}
