import { NextResponse } from "next/server";
import {
  articleTypeToDb,
  dateOrNull,
  normalizeCoverage,
  normalizeSubmission,
  resolveOutletId,
  submissionDate,
  submissionStatusToDb,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { mediaInputSchema } from "@/lib/schemas/media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const [coverages, submissions] = await Promise.all([
    prisma.pressCoverage.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    prisma.pressSubmission.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
  ]);

  const records = [...coverages.map(normalizeCoverage), ...submissions.map(normalizeSubmission)];
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Validation failed", details: { _errors: ["Invalid JSON"] } }, { status: 400 });
  }

  const parsed = mediaInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const payload = parsed.data;
  const outletId = await resolveOutletId(prisma, projectId, payload.outlet);
  const articleType = articleTypeToDb(payload.articleType);
  const articleTypeOther = articleType === "Other" ? payload.articleTypeOther || null : null;

  if (payload.recordType === "Press Coverage") {
    const coverage = await prisma.pressCoverage.create({
      data: {
        projectId,
        title: payload.title,
        outlet: payload.outlet,
        outletId,
        articleType,
        articleTypeOther,
        publishedArticleUrl: payload.articleUrl || null,
        publicationDate: dateOrNull(payload.publicationDate),
        summary: payload.notes || null,
      },
    });
    return NextResponse.json(normalizeCoverage(coverage), { status: 201 });
  }

  const status = submissionStatusToDb(payload.status);
  const submission = await prisma.pressSubmission.create({
    data: {
      projectId,
      title: payload.title,
      outlet: payload.outlet,
      outletId,
      articleType,
      articleTypeOther,
      status,
      dateSubmitted: submissionDate(status, payload.dateSubmitted),
      responsiblePerson: payload.responsiblePerson || null,
      followUpDate: dateOrNull(payload.followUpDate),
      draftUrl: payload.documentUrl || null,
      publishedArticleUrl: payload.articleUrl || null,
      notes: payload.notes || null,
      coverageId: payload.linkedCoverageId || null,
    },
  });
  return NextResponse.json(normalizeSubmission(submission), { status: 201 });
}
