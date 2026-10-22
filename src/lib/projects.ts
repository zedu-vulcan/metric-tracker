import { randomBytes, randomInt } from "node:crypto";
import type { Prisma, ProjectRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api";
import { DEFAULT_POINT_RULES, DEFAULT_TASK_TYPES } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { serializeProjectBrief, type ProjectBriefRecord } from "@/lib/project-brief";

/** The header the dashboard sends with every request, naming the project it's working in. */
export const PROJECT_HEADER = "x-project-id";

const ROLE_RANK: Record<ProjectRole, number> = { member: 0, admin: 1, owner: 2 };

/** True when `role` is at least `minimum` (owner > admin > member). */
export function hasRole(role: ProjectRole, minimum: ProjectRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// No 0/O or 1/I/L, so codes survive being read aloud or typed from a screenshot.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A join code like `K7QX-3MPR`. */
export function generateJoinCode() {
  const pick = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

/** The secret part of the invite link, `/join/<token>`. */
export function generateInviteToken() {
  return randomBytes(24).toString("base64url");
}

/** Codes are shown upper case with a dash, but people type them any way. */
export function normalizeJoinCode(code: string) {
  const compact = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "project"
  );
}

/** A slug that isn't taken yet: `acme`, then `acme-2`, `acme-3`… */
async function availableSlug(tx: Prisma.TransactionClient, name: string) {
  const base = slugify(name);
  const taken = new Set(
    (await tx.project.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((p) => p.slug)
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Creates a project owned by `userId`, with its brief, the default task types and point rules. */
export async function createProject(
  userId: string,
  { name, description, siteUrl }: { name: string; description: string; siteUrl?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name,
        description,
        siteUrl: siteUrl ?? null,
        briefUpdatedAt: new Date(),
        slug: await availableSlug(tx, name),
        joinCode: generateJoinCode(),
        inviteToken: generateInviteToken(),
        createdById: userId,
        members: { create: { userId, role: "owner" } },
      },
    });
    await tx.taskTypeDef.createMany({
      data: DEFAULT_TASK_TYPES.map((type) => ({ ...type, projectId: project.id, updatedBy: userId })),
    });
    await tx.pointRule.createMany({
      data: DEFAULT_POINT_RULES.map((rule) => ({ ...rule, projectId: project.id })),
    });
    return project;
  });
}

/** Adds `userId` to the project as a member; joining twice keeps the existing role. */
export async function joinProject(userId: string, projectId: string) {
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId, role: "member" },
  });
}

/** Projects the user belongs to, oldest membership first. */
export function listUserProjects(userId: string) {
  return prisma.projectMember.findMany({
    where: { userId },
    include: { project: { select: { id: true, name: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });
}

export function getMembership(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
}

/** The project a dashboard request is for: the `x-project-id` header, or `?projectId=`. */
export function requestedProjectId(request: Request) {
  return request.headers.get(PROJECT_HEADER) ?? new URL(request.url).searchParams.get("projectId");
}

/**
 * For routes that have already authenticated the caller: true when the agent works in
 * `projectId`, or the person is a member of it. Use it before acting on a loaded record.
 */
export async function callerInProject(
  projectId: string,
  caller: { agent: { projectId: string } } | { userId: string }
) {
  if ("agent" in caller) return caller.agent.projectId === projectId;
  return (await getMembership(caller.userId, projectId)) !== null;
}

export type ProjectAccess =
  | {
      error: null;
      projectId: string;
      /** The signed-in person, or null when an agent key made the request. */
      user: { id: string; name?: string | null; email?: string | null } | null;
      role: ProjectRole | null;
      agent: Awaited<ReturnType<typeof getAuthContext>>["agent"];
    }
  | { error: NextResponse; projectId: null; user: null; role: null; agent: null };

function denied(error: NextResponse): ProjectAccess {
  return { error, projectId: null, user: null, role: null, agent: null };
}

/**
 * Resolves which project a request acts in and checks the caller may act there.
 * Agents are always in their own project; people must be members of the project they name
 * (or of `projectId`, when the route already knows it from the record it loaded).
 * `minimumRole` applies to people only.
 */
export async function requireProjectAccess(
  request: Request,
  { projectId, minimumRole = "member", allowAgents = true }: {
    projectId?: string;
    minimumRole?: ProjectRole;
    allowAgents?: boolean;
  } = {}
): Promise<ProjectAccess> {
  const auth = await getAuthContext(request);
  if (auth.error) return denied(auth.error);

  if (auth.type === "agent") {
    if (!allowAgents) {
      return denied(
        NextResponse.json({ error: "Agents are not permitted to perform this action. Human user required." }, { status: 403 })
      );
    }
    if (projectId && projectId !== auth.agent.projectId) return denied(NextResponse.json({ error: "Not found" }, { status: 404 }));
    return { error: null, projectId: auth.agent.projectId, user: null, role: null, agent: auth.agent };
  }

  const target = projectId ?? requestedProjectId(request);
  if (!target) {
    return denied(
      NextResponse.json(
        { error: "Validation failed", details: { projectId: ["Say which project, with the x-project-id header"] } },
        { status: 400 }
      )
    );
  }

  const membership = await getMembership(auth.user.id, target);
  // A project you don't belong to looks the same as one that doesn't exist.
  if (!membership) return denied(NextResponse.json({ error: "Not found" }, { status: 404 }));
  if (!hasRole(membership.role, minimumRole)) {
    return denied(NextResponse.json({ error: `Only a project ${minimumRole} can do this` }, { status: 403 }));
  }

  return { error: null, projectId: target, user: auth.user, role: membership.role, agent: null };
}

type ProjectRecord = { id: string; name: string; slug: string; joinCode: string; inviteToken: string; createdAt: Date } & ProjectBriefRecord;

/** A project as its members see it; the join code and invite token only go to owners and admins. */
export function serializeProject(project: ProjectRecord, role: ProjectRole, memberCount: number) {
  const manager = hasRole(role, "admin");
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    role,
    memberCount,
    joinCode: manager ? project.joinCode : null,
    inviteToken: manager ? project.inviteToken : null,
    brief: serializeProjectBrief(project),
    createdAt: project.createdAt.toISOString(),
  };
}

/** Reads a JSON body, or returns the standard 400 when it isn't JSON. */
export async function readJson(request: Request): Promise<{ body: unknown; error: null } | { body: null; error: NextResponse }> {
  try {
    return { body: await request.json(), error: null };
  } catch {
    return {
      body: null,
      error: NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 }),
    };
  }
}

export function validationError(details: Record<string, string[] | undefined>) {
  return NextResponse.json({ error: "Validation failed", details }, { status: 400 });
}
