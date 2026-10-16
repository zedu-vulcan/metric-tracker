import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  ListBodySchema,
  DirectoryBodySchema,
  CreateSubmissionBodySchema,
  UpdateSubmissionBodySchema,
  TrafficBodySchema,
  SubmissionStatusSchema,
} from "./schemas";

const registry = new OpenAPIRegistry();

const IdField = z.string().openapi({ example: "clxxxxxxxxxxxxxxxx" });
const DateTimeField = z.string().datetime().openapi({ example: "2026-10-15T00:00:00.000Z" });

const ListSchema = registry.register(
  "List",
  ListBodySchema.extend({
    id: IdField,
    createdAt: DateTimeField,
    updatedAt: DateTimeField,
    _count: z.object({ directories: z.number().int() }),
  }).openapi("List"),
);

const DirectorySchema = registry.register(
  "Directory",
  z.object({
    id: IdField,
    name: z.string(),
    url: z.string().nullable(),
    listId: IdField,
    list: z.object({ id: IdField, name: z.string() }),
    submission: z.object({ id: IdField, status: SubmissionStatusSchema }).nullable().optional(),
    createdAt: DateTimeField,
    updatedAt: DateTimeField,
  }).openapi("Directory"),
);

const SubmissionSchema = registry.register(
  "Submission",
  z.object({
    id: IdField,
    directoryId: IdField,
    status: SubmissionStatusSchema,
    submittedAt: DateTimeField.nullable(),
    listingUrl: z.string().url().nullable(),
    createdAt: DateTimeField,
    updatedAt: DateTimeField,
    directory: z.object({
      id: IdField,
      name: z.string(),
      url: z.string().nullable(),
      list: z.object({ id: IdField, name: z.string() }),
    }),
    _count: z.object({ traffic: z.number().int() }),
  }).openapi("Submission"),
);

const TrafficSchema = registry.register(
  "Traffic",
  z.object({
    id: IdField,
    submissionId: IdField,
    date: z.string().openapi({ example: "2026-10-15" }),
    visits: z.number().int().openapi({ example: 1200 }),
    createdAt: DateTimeField,
  }).openapi("Traffic"),
);

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.string().openapi({ example: "Validation failed" }),
    details: z.record(z.string(), z.array(z.string())).optional(),
  }).openapi("Error"),
);

registry.registerComponent("securitySchemes", "sessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "next-auth.session-token",
  description: "NextAuth session cookie — obtained after Google OAuth sign-in at `/api/auth/signin`.",
});

const auth = [{ sessionCookie: [] }];
const r400 = { description: "Validation error", content: { "application/json": { schema: ErrorSchema } } };
const r401 = { description: "Unauthorized — no active session" };
const r404 = { description: "Not found" };

// ── Lists ─────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get", path: "/api/lists", tags: ["Lists"],
  summary: "List all lists", security: auth,
  responses: { 200: { description: "List of lists", content: { "application/json": { schema: z.array(ListSchema) } } }, 401: r401 },
});

registry.registerPath({
  method: "post", path: "/api/lists", tags: ["Lists"],
  summary: "Create a list", security: auth,
  request: { body: { required: true, content: { "application/json": { schema: ListBodySchema } } } },
  responses: { 201: { description: "List created", content: { "application/json": { schema: ListSchema } } }, 400: r400, 401: r401 },
});

registry.registerPath({
  method: "delete", path: "/api/lists/{id}", tags: ["Lists"],
  summary: "Delete a list", description: "Cascades to all directories and their submissions.",
  security: auth,
  request: { params: z.object({ id: IdField }) },
  responses: { 204: { description: "Deleted" }, 401: r401, 404: r404 },
});

// ── Directories ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get", path: "/api/directories", tags: ["Directories"],
  summary: "List all directories", security: auth,
  responses: { 200: { description: "All directories with list and submission info", content: { "application/json": { schema: z.array(DirectorySchema) } } }, 401: r401 },
});

registry.registerPath({
  method: "post", path: "/api/directories", tags: ["Directories"],
  summary: "Add a directory to a list", security: auth,
  request: { body: { required: true, content: { "application/json": { schema: DirectoryBodySchema } } } },
  responses: { 201: { description: "Directory created", content: { "application/json": { schema: DirectorySchema } } }, 400: r400, 401: r401 },
});

registry.registerPath({
  method: "delete", path: "/api/directories/{id}", tags: ["Directories"],
  summary: "Delete a directory", description: "Cascades to its submission and traffic.",
  security: auth,
  request: { params: z.object({ id: IdField }) },
  responses: { 204: { description: "Deleted" }, 401: r401, 404: r404 },
});

// ── Submissions ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get", path: "/api/submissions", tags: ["Submissions"],
  summary: "List all submissions", security: auth,
  responses: { 200: { description: "All submissions", content: { "application/json": { schema: z.array(SubmissionSchema) } } }, 401: r401 },
});

registry.registerPath({
  method: "post", path: "/api/submissions", tags: ["Submissions"],
  summary: "Track a directory submission", security: auth,
  request: { body: { required: true, content: { "application/json": { schema: CreateSubmissionBodySchema } } } },
  responses: { 201: { description: "Submission created", content: { "application/json": { schema: SubmissionSchema } } }, 400: r400, 401: r401 },
});

registry.registerPath({
  method: "patch", path: "/api/submissions/{id}", tags: ["Submissions"],
  summary: "Update a submission", security: auth,
  request: { params: z.object({ id: IdField }), body: { required: true, content: { "application/json": { schema: UpdateSubmissionBodySchema } } } },
  responses: { 200: { description: "Updated submission", content: { "application/json": { schema: SubmissionSchema } } }, 400: r400, 401: r401, 404: r404 },
});

registry.registerPath({
  method: "delete", path: "/api/submissions/{id}", tags: ["Submissions"],
  summary: "Delete a submission", security: auth,
  request: { params: z.object({ id: IdField }) },
  responses: { 204: { description: "Deleted" }, 401: r401, 404: r404 },
});

// ── Traffic ───────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post", path: "/api/submissions/{id}/traffic", tags: ["Traffic"],
  summary: "Add a traffic entry", security: auth,
  request: { params: z.object({ id: IdField }), body: { required: true, content: { "application/json": { schema: TrafficBodySchema } } } },
  responses: { 201: { description: "Traffic entry created", content: { "application/json": { schema: TrafficSchema } } }, 400: r400, 401: r401, 404: r404 },
});

registry.registerPath({
  method: "delete", path: "/api/submissions/{id}/traffic/{trafficId}", tags: ["Traffic"],
  summary: "Delete a traffic entry", security: auth,
  request: { params: z.object({ id: IdField, trafficId: IdField }) },
  responses: { 204: { description: "Deleted" }, 401: r401, 404: r404 },
});

export function getOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Metric Tracker API",
      version: "2.0.0",
      description:
        "REST API for tracking directory submissions. Directories are organised in named lists. All endpoints require an active NextAuth session.",
    },
    servers: [{ url: process.env.NEXTAUTH_URL ?? "http://localhost:3000", description: "Current environment" }],
  });
}
