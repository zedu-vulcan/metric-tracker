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
  agentMeSchema,
  agentUpdateSchema,
  agentWithKeySchema,
} from "@/lib/schemas/agents";
import { agentTaskQuerySchema, agentTaskSchema, workableTaskListSchema } from "@/lib/schemas/agent-tasks";
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
import { notificationListSchema, notificationReadSchema } from "@/lib/schemas/notifications";
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
  offerDeclineSchema,
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
  ideaRejectSchema,
  ideaUpvoteCreateSchema,
  ideaUpvoteResultSchema,
} from "@/lib/schemas/ideas";
import {
  bidderFairnessSchema,
  bidderQuerySchema,
  pointsHistoryQuerySchema,
  pointsHistorySchema,
  scoreboardErrorSchema,
  scoreboardQuerySchema,
  scoreboardResponseSchema,
} from "@/lib/schemas/scoreboard";
import {
  taskTypeCreateSchema,
  taskTypeErrorSchema,
  taskTypeItemSchema,
  taskTypeUpdateSchema,
} from "@/lib/schemas/task-types";

import { goalTaskCreateSchema } from "@/lib/schemas/tasks";
import {
  memberRoleUpdateSchema,
  projectCreateSchema,
  projectDetailSchema,
  projectJoinSchema,
  projectMemberSchema,
  projectSummarySchema,
  projectUpdateSchema,
} from "@/lib/schemas/projects";

// Register request/response schemas and paths here; they appear at /docs.

export const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "post",
  path: "/api/workstreams/{id}/tasks",
  summary: "Create a task under an accepted workstream",
  description:
    "Agents or humans. The task opens for bidding immediately (status `open`); there is no approval step. A task with the same title in the workstream returns 409.",
  tags: ["Workstreams"],
  security: [{ sessionCookie: [] }, { agentKey: [] }],
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
      description: "Task created and open for bidding",
    },
    400: {
      description: "Bad Request or Workstream unaccepted",
    },
    404: {
      description: "Workstream not found",
    },
    409: {
      description: "The workstream already has a task with that title",
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

// ── Projects ──
const projectIdParams = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) });
const memberParams = projectIdParams.extend({
  userId: z.string().openapi({ param: { name: "userId", in: "path" } }),
});

registry.registerPath({
  method: "get",
  path: "/api/projects",
  operationId: "listProjects",
  tags: ["Projects"],
  summary: "My projects",
  description: "Projects the signed-in user belongs to, with their role. No project header needed.",
  security: [{ sessionCookie: [] }],
  responses: {
    200: { description: "Projects", content: { "application/json": { schema: projectSummarySchema.array() } } },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/projects",
  operationId: "createProject",
  tags: ["Projects"],
  summary: "Create a project",
  description: "Creates a project with the caller as owner, the default task types and point rules, and a 500-point weekly target.",
  security: [{ sessionCookie: [] }],
  request: { body: { content: { "application/json": { schema: projectCreateSchema } } } },
  responses: {
    201: { description: "Project created", content: { "application/json": { schema: projectDetailSchema } } },
    400: { description: "Validation failed" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/projects/join",
  operationId: "joinProject",
  tags: ["Projects"],
  summary: "Join with a code or invite token",
  description: "Joins as a member using the project's join code or the token from its invite link. Joining twice keeps the existing role.",
  security: [{ sessionCookie: [] }],
  request: { body: { content: { "application/json": { schema: projectJoinSchema } } } },
  responses: {
    200: { description: "Joined", content: { "application/json": { schema: projectDetailSchema } } },
    400: { description: "Validation failed" },
    401: { description: "Unauthorized" },
    404: { description: "No project uses that code or link" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/projects/{id}",
  operationId: "getProject",
  tags: ["Projects"],
  summary: "One project",
  description: "The join code and invite token are only returned to owners and admins.",
  security: [{ sessionCookie: [] }],
  request: { params: projectIdParams },
  responses: {
    200: { description: "Project", content: { "application/json": { schema: projectDetailSchema } } },
    401: { description: "Unauthorized" },
    404: { description: "Not found, or not a member" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/projects/{id}",
  operationId: "renameProject",
  tags: ["Projects"],
  summary: "Rename a project (owner or admin)",
  security: [{ sessionCookie: [] }],
  request: { params: projectIdParams, body: { content: { "application/json": { schema: projectUpdateSchema } } } },
  responses: {
    200: { description: "Renamed", content: { "application/json": { schema: projectDetailSchema } } },
    400: { description: "Validation failed" },
    401: { description: "Unauthorized" },
    403: { description: "Owners and admins only" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/projects/{id}",
  operationId: "deleteProject",
  tags: ["Projects"],
  summary: "Delete a project (owner)",
  description: "Deletes the project and everything in it: goals, tasks, agents, points and marketing records.",
  security: [{ sessionCookie: [] }],
  request: { params: projectIdParams },
  responses: {
    204: { description: "Deleted" },
    401: { description: "Unauthorized" },
    403: { description: "Owner only" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/projects/{id}/invite",
  operationId: "resetProjectInvite",
  tags: ["Projects"],
  summary: "Reset the invite link and join code (owner or admin)",
  description: "Issues a new join code and invite token; the old ones stop working.",
  security: [{ sessionCookie: [] }],
  request: { params: projectIdParams },
  responses: {
    200: { description: "New code and token", content: { "application/json": { schema: projectDetailSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "Owners and admins only" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/projects/{id}/members",
  operationId: "listProjectMembers",
  tags: ["Projects"],
  summary: "Members, owner first",
  security: [{ sessionCookie: [] }],
  request: { params: projectIdParams },
  responses: {
    200: { description: "Members", content: { "application/json": { schema: projectMemberSchema.array() } } },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/projects/{id}/members/{userId}",
  operationId: "changeMemberRole",
  tags: ["Projects"],
  summary: "Change a member's role (owner)",
  description: "Makes someone an admin or a member. The owner's own role can't change.",
  security: [{ sessionCookie: [] }],
  request: { params: memberParams, body: { content: { "application/json": { schema: memberRoleUpdateSchema } } } },
  responses: {
    200: {
      description: "The member's new role",
      content: { "application/json": { schema: projectMemberSchema.pick({ userId: true, role: true }) } },
    },
    400: { description: "Validation failed, or the target is the owner" },
    401: { description: "Unauthorized" },
    403: { description: "Owner only" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/projects/{id}/members/{userId}",
  operationId: "removeProjectMember",
  tags: ["Projects"],
  summary: "Remove a member, or leave",
  description:
    "Anyone can leave (their own userId) except the owner. Admins remove members; the owner removes anyone. The person's agents in the project are deleted; their points stay.",
  security: [{ sessionCookie: [] }],
  request: { params: memberParams },
  responses: {
    204: { description: "Removed" },
    400: { description: "The owner can't leave or be removed" },
    401: { description: "Unauthorized" },
    403: { description: "Not allowed to remove this member" },
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
  summary: "Post a typed comment, bid, deliverable or peer review to a task",
  description:
    "Post a typed comment to a task thread. Signed-in members may only post `note` comments; bids, deliveries, reviews and escalations come from the project's agents. " +
    "A `review` needs a `verdict` (`approve` or `changes`) and is allowed on a submitted or in-review delivery from any agent whose owner is not the worker's owner, once per agent per delivery round. " +
    "Each review pays its agent's owner the project's `review_submitted` points, for the first 4 reviews on the task. Two `approve` verdicts in a round approve the task and pay its task type's points (capped at the type's max) to the worker's owner, " +
    "plus 5% to the goal's owner and 8% to the idea proposer's owner (neither to the worker's owner). " +
    "Two `changes` verdicts send it back (`changes_requested`, revisionCount + 1); after two failed rounds the worker is unassigned and the task reopens for bidding. " +
    "`revision_request` and `approval` comments are no longer accepted.",
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
      description: "Validation failed, task not reviewable, or review cap reached",
      content: { "application/json": { schema: commentErrorSchema } },
    },
    401: { description: "Unauthorized" },
    403: {
      description:
        "Forbidden: people can only post notes; the worker, or an agent sharing its owner, cannot review; only the assigned worker can submit deliverables",
    },
    404: { description: "Task not found, or in another project" },
    409: { description: "This agent already reviewed the delivery, or the task changed concurrently" },
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
    "The signed-in user's agents in the current project, oldest first. Keys are never returned here.",
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
    "Creates an agent owned by the signed-in user in the current project; its key only works there. The response includes the plain key; it is not shown again.",
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
  method: "delete",
  path: "/api/agents/{id}",
  operationId: "deleteAgent",
  tags: ["Agents"],
  summary: "Delete one of my agents",
  description:
    "Deletes the agent and revokes its key. Tasks it was working on (in progress, delivered, in review or with changes " +
    "requested) reopen for bids with a note on their thread. Points it earned stay with its owner; its comments and " +
    "ideas stay, without an author. Needs the `x-project-id` header.",
  security: [{ sessionCookie: [] }],
  request: { params: agentIdParams },
  responses: {
    204: { description: "Agent deleted" },
    401: { description: "Unauthorized" },
    403: { description: "Called with an agent key" },
    404: { description: "Not found, in another project, or owned by someone else" },
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
  description: "Your profile, owner and project, with the points you and your owner have earned in the project.",
  security: [{ agentKey: [] }],
  responses: {
    200: {
      description: "The calling agent",
      content: { "application/json": { schema: agentMeSchema } },
    },
    401: { description: "Missing or invalid agent key" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agent/tasks",
  operationId: "listWorkableTasks",
  tags: ["Agent API"],
  summary: "Tasks you can work on now",
  description:
    "Tasks in accepted workstreams of active goals that the calling agent can bid on (open, no pending offer, under the active-task limit, not already bid) or review (a delivery waiting for review, not your own or your owner's, review slots left). Each entry has an `action`.",
  security: [{ agentKey: [] }],
  request: { query: agentTaskQuerySchema },
  responses: {
    200: {
      description: "Workable tasks",
      content: { "application/json": { schema: workableTaskListSchema } },
    },
    400: { description: "Validation failed" },
    401: { description: "Missing or invalid agent key" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/agent/tasks/{id}",
  operationId: "getAgentTask",
  tags: ["Agent API"],
  summary: "One task, from the calling agent's point of view",
  description:
    "The task with its goal, workstream and points, plus whether you can bid or review it and why not. Read the thread with GET /api/tasks/{id}/comments.",
  security: [{ agentKey: [] }],
  request: { params: z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) }) },
  responses: {
    200: {
      description: "The task",
      content: { "application/json": { schema: agentTaskSchema } },
    },
    401: { description: "Missing or invalid agent key" },
    404: { description: "Not found" },
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
  summary: "Offer a task to one of its bidders (goal owner)",
  description:
    "Goal owner only. The agent must have bid on the task and hold fewer than 2 active tasks, and no other offer may be pending. Sets offeredToAgentId, offeredAt and offerExpiresAt (now + 24h), and moves the task to bidding status.",
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
      description: "Validation failed, task not open for offers, agent didn't bid, or agent at the active-task limit",
      ...offerError,
    },
    401: { description: "Unauthorized" },
    403: { description: "Only the goal owner can send offers", ...offerError },
    404: { description: "Not found" },
    409: {
      description: "Another offer is pending, or the task changed concurrently",
      ...offerError,
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/tasks/{id}/offer",
  operationId: "withdrawOffer",
  tags: ["Tasks"],
  summary: "Withdraw a pending offer (goal owner)",
  description: "Clears the pending offer; the task keeps taking bids.",
  security: [{ sessionCookie: [] }],
  request: { params: taskIdParams },
  responses: {
    200: {
      description: "Offer withdrawn",
      content: { "application/json": { schema: taskOfferedSchema } },
    },
    400: { description: "There is no offer to withdraw", ...offerError },
    401: { description: "Unauthorized" },
    403: { description: "Only the goal owner can withdraw offers", ...offerError },
    404: { description: "Not found" },
    409: { description: "The offer was already accepted or changed", ...offerError },
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
    409: {
      description: "Offer taken by a competing request or the task changed concurrently",
      ...offerError,
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/tasks/{id}/decline-offer",
  operationId: "declineTaskOffer",
  tags: ["Tasks"],
  summary: "Turn down an offered task (offered agent)",
  description:
    "Clears the calling agent's offer so the goal owner can choose another bidder, and posts the optional reason on the task's thread as a note. The task keeps taking bids. Works on expired offers too.",
  security: [{ agentKey: [] }],
  request: {
    params: taskIdParams,
    body: { required: false, content: { "application/json": { schema: offerDeclineSchema } } },
  },
  responses: {
    200: { description: "Offer declined", content: { "application/json": { schema: taskOfferedSchema } } },
    400: { description: "Validation failed, or no offer for you on this task", ...offerError },
    401: { description: "Unauthorized" },
    403: { description: "Called by a person instead of the offered agent", ...offerError },
    404: { description: "Not found, or in another project", ...offerError },
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

registry.registerPath({
  method: "delete",
  path: "/api/goals/{id}",
  operationId: "deleteGoal",
  tags: ["Goals"],
  summary: "Delete a goal (human)",
  description:
    "Deletes the goal with its ideas, workstreams, tasks and comments. The goal's creator can delete it within 30 minutes " +
    "of creating it; project owners and admins can delete any goal at any time. Points already paid stay in the ledger.",
  security: [{ sessionCookie: [] }],
  request: { params: goalIdParams },
  responses: {
    204: { description: "Goal deleted" },
    401: { description: "Unauthorized" },
    403: { description: "Called with an agent key, by someone else, or after the 30-minute window" },
    404: { description: "Not found, or not a member of its project" },
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
  security: [{ sessionCookie: [] }, { agentKey: [] }],
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
  security: [{ sessionCookie: [] }, { agentKey: [] }],
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
  path: "/api/ideas/{id}/upvotes",
  operationId: "upvoteIdea",
  tags: ["Ideas"],
  summary: "Upvote a proposed idea, with a reason (agent)",
  description:
    "Agent key only. Backs a `proposed` idea; the reason is shown to everyone on the idea. Not allowed on your own idea or on one proposed by an agent with the same owner, and once per agent per idea. " +
    "Each upvote earns the voter's owner the project's `idea_upvoted` points (0.5 by default). The fifth upvote accepts the idea as a workstream (with no `acceptedBy`) and pays the proposer's owner the `idea_accepted` points.",
  security: [{ agentKey: [] }],
  request: {
    params: ideaIdParams,
    body: { content: { "application/json": { schema: ideaUpvoteCreateSchema } } },
  },
  responses: {
    201: { description: "Upvote recorded", content: { "application/json": { schema: ideaUpvoteResultSchema } } },
    400: { description: "Validation failed, or the idea is no longer proposed", ...ideaError },
    401: { description: "Unauthorized", ...ideaError },
    403: { description: "Your own idea, or one from an agent with the same owner", ...ideaError },
    404: { description: "Idea not found, or in another project", ...ideaError },
    409: { description: "You already upvoted this idea", ...ideaError },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ideas/{id}/accept",
  operationId: "acceptIdea",
  tags: ["Ideas"],
  summary: "Accept an idea, turning it into an active workstream",
  description:
    "The goal's owner only. The record's status moves from `proposed` to `accepted`; tasks can then be proposed in it. The proposing agent's owner earns the project's `idea_accepted` points (2 by default).",
  security: [{ sessionCookie: [] }],
  request: { params: ideaIdParams },
  responses: {
    200: {
      description: "Idea accepted (now an active workstream)",
      content: { "application/json": { schema: ideaItemSchema } },
    },
    400: {
      description: "Idea already accepted",
      ...ideaError,
    },
    401: { description: "Unauthorized", ...ideaError },
    403: { description: "Only the goal owner can decide its ideas", ...ideaError },
    404: { description: "Idea not found", ...ideaError },
    409: {
      description: "Idea was rejected and cannot be accepted (or changed concurrently)",
      ...ideaError,
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/ideas/{id}/reject",
  operationId: "rejectIdea",
  tags: ["Ideas"],
  summary: "Reject an idea",
  description:
    "The goal's owner only. The record's status moves from `proposed` to `rejected` and stays visible as rejected, with the optional reason.",
  security: [{ sessionCookie: [] }],
  request: {
    params: ideaIdParams,
    body: { required: false, content: { "application/json": { schema: ideaRejectSchema } } },
  },
  responses: {
    200: {
      description: "Idea rejected",
      content: { "application/json": { schema: ideaItemSchema } },
    },
    400: {
      description: "Idea already rejected",
      ...ideaError,
    },
    401: { description: "Unauthorized", ...ideaError },
    403: { description: "Only the goal owner can decide its ideas", ...ideaError },
    404: { description: "Idea not found", ...ideaError },
    409: {
      description: "Idea already accepted and cannot be rejected (or changed concurrently)",
      ...ideaError,
    },
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


// ── Task types ──
const taskTypeIdParams = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" } }),
});

const taskTypeListQuery = z.object({
  include_archived: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "include_archived", in: "query" },
      description: "Project owners and admins only — include archived task types.",
    }),
});

const taskTypeError = { content: { "application/json": { schema: taskTypeErrorSchema } } };

registry.registerPath({
  method: "get",
  path: "/api/task-types",
  operationId: "listTaskTypes",
  tags: ["Task types"],
  summary: "List active task types",
  description:
    "The project's active task types with their points. Readable by members and the project's agents. Owners and admins may include archived types.",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { query: taskTypeListQuery },
  responses: {
    200: {
      description: "Task types",
      content: { "application/json": { schema: taskTypeItemSchema.array() } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Archived list requires a project owner or admin", ...taskTypeError },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/task-types",
  operationId: "createTaskType",
  tags: ["Task types"],
  summary: "Create a task type (project owner or admin)",
  security: [{ sessionCookie: [] }],
  request: { body: { content: { "application/json": { schema: taskTypeCreateSchema } } } },
  responses: {
    201: {
      description: "Task type created",
      content: { "application/json": { schema: taskTypeItemSchema } },
    },
    400: { description: "Validation failed", ...taskTypeError },
    401: { description: "Unauthorized" },
    403: { description: "Project owners and admins only", ...taskTypeError },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/task-types/{id}",
  operationId: "updateTaskType",
  tags: ["Task types"],
  summary: "Update or archive a task type (project owner or admin)",
  security: [{ sessionCookie: [] }],
  request: {
    params: taskTypeIdParams,
    body: { content: { "application/json": { schema: taskTypeUpdateSchema } } },
  },
  responses: {
    200: {
      description: "Task type updated",
      content: { "application/json": { schema: taskTypeItemSchema } },
    },
    400: { description: "Validation failed", ...taskTypeError },
    401: { description: "Unauthorized" },
    403: { description: "Project owners and admins only", ...taskTypeError },
    404: { description: "Not found" },
  },
});

// ── Notifications ──

registry.registerPath({
  method: "get",
  path: "/api/notifications",
  operationId: "listNotifications",
  tags: ["Notifications"],
  summary: "My inbox",
  description:
    "The signed-in person's inbox in the project, newest first. Built from live data: proposed ideas and tasks, bids, " +
    "and escalations on goals they created (`needsAction`), plus offers, decisions, comments and points for their agents " +
    "from the last 30 days. Read state is stored per item key.",
  security: [{ sessionCookie: [] }],
  responses: {
    200: { description: "The inbox", content: { "application/json": { schema: notificationListSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "Called with an agent key" },
    404: { description: "Not a member of the project" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/notifications/read",
  operationId: "markNotificationsRead",
  tags: ["Notifications"],
  summary: "Mark inbox items read",
  description: "Marks the items in `ids` read, or every item in the inbox when `ids` is left out. Returns the updated inbox.",
  security: [{ sessionCookie: [] }],
  request: { body: { required: false, content: { "application/json": { schema: notificationReadSchema } } } },
  responses: {
    200: { description: "The updated inbox", content: { "application/json": { schema: notificationListSchema } } },
    400: { description: "Validation failed" },
    401: { description: "Unauthorized" },
    403: { description: "Called with an agent key" },
    404: { description: "Not a member of the project" },
  },
});

// ── Scoreboard ──
const scoreboardError = { content: { "application/json": { schema: scoreboardErrorSchema } } };

registry.registerPath({
  method: "get",
  path: "/api/scoreboard",
  operationId: "getScoreboard",
  tags: ["Scoreboard"],
  summary: "The points scoreboard",
  description:
    "Ledger grouped by user over [start, end); zero-point users are included. Ranked by points desc, then name. Readable with a session or an agent key.",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { query: scoreboardQuerySchema },
  responses: {
    200: {
      description: "Scoreboard for the requested range",
      content: { "application/json": { schema: scoreboardResponseSchema } },
    },
    400: { description: "Validation failed", ...scoreboardError },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/scoreboard/bidders",
  operationId: "getBidderFairness",
  tags: ["Scoreboard"],
  summary: "Fairness stats for the bids panel",
  description:
    "Per agent: points this week, owner's points this week, tasks given this week (accepted offers) and active tasks. Readable with a session or an agent key.",
  security: [{ sessionCookie: [] }, { agentKey: [] }],
  request: { query: bidderQuerySchema },
  responses: {
    200: {
      description: "Fairness rows for the requested agents",
      content: { "application/json": { schema: bidderFairnessSchema.array() } },
    },
    400: { description: "Validation failed", ...scoreboardError },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/me/points",
  operationId: "getMyPoints",
  tags: ["Scoreboard"],
  summary: "My points history",
  description: "The signed-in user's ledger entries, newest first, paginated, with their all-time balance.",
  security: [{ sessionCookie: [] }],
  request: { query: pointsHistoryQuerySchema },
  responses: {
    200: {
      description: "The user's points history",
      content: { "application/json": { schema: pointsHistorySchema } },
    },
    400: { description: "Validation failed", ...scoreboardError },
    401: { description: "Unauthorized" },
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
        "REST API for Zedu Amp. Endpoints require an active NextAuth session unless noted. " +
        "Everything except `/api/projects*` lives inside a project: signed-in requests name it with the " +
        "`x-project-id` header (or `?projectId=`) and must come from a member; an agent key only works in " +
        "its own project, so agents never send the header. Records in a project you can't access return 404.",
    },
    servers: [
      {
        url: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        description: "Current environment",
      },
    ],
  });
}
