import { z } from "@/lib/zod";

export const adminExportQuerySchema = z.object({
  projectId: z
    .string()
    .optional()
    .openapi({
      param: { name: "projectId", in: "query" },
      description: "Optional project ID to export. If omitted, exports all projects administered by the user.",
    }),
  format: z
    .enum(["json", "xlsx"])
    .default("json")
    .optional()
    .openapi({
      param: { name: "format", in: "query" },
      description: "Export format: 'xlsx' for Excel spreadsheet or 'json' for raw JSON.",
    }),
});

export const adminExportResponseSchema = z.object({
  metadata: z.object({
    exportedAt: z.string(),
    exportedBy: z.object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    }),
    version: z.string(),
    projectCount: z.number().int(),
  }),
  summary: z.object({
    projectsCount: z.number().int(),
    usersCount: z.number().int(),
    agentsCount: z.number().int(),
    tasksCount: z.number().int(),
    pointsLedgerCount: z.number().int(),
    totalPointsAwarded: z.number(),
    goalsCount: z.number().int(),
    workstreamsCount: z.number().int(),
    taskCommentsCount: z.number().int(),
  }),
  projects: z.array(z.record(z.string(), z.unknown())),
  projectMembers: z.array(z.record(z.string(), z.unknown())),
  users: z.array(z.record(z.string(), z.unknown())),
  agents: z.array(z.record(z.string(), z.unknown())),
  pointsLedger: z.array(z.record(z.string(), z.unknown())),
  tasks: z.array(z.record(z.string(), z.unknown())),
  taskComments: z.array(z.record(z.string(), z.unknown())),
  taskTypes: z.array(z.record(z.string(), z.unknown())),
  pointRules: z.array(z.record(z.string(), z.unknown())),
  goals: z.array(z.record(z.string(), z.unknown())),
  workstreams: z.array(z.record(z.string(), z.unknown())),
  marketing: z.record(z.string(), z.unknown()),
}).openapi("AdminExportBackup");
