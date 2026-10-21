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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

  const [existingSubmission, existingCoverage] = await Promise.all([
    prisma.pressSubmission.findFirst({ where: { id: params.id, projectId } }),
    prisma.pressCoverage.findFirst({ where: { id: params.id, projectId } }),
  ]);
  if (!existingSubmission && !existingCoverage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = parsed.data;
  // A record keeps its type; a pitch becomes coverage through POST /api/media/{id}/feature.
  const isCoverage = existingCoverage !== null;
  if ((payload.recordType === "Press Coverage") !== isCoverage) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: { recordType: [`This record is a ${isCoverage ? "Press Coverage" : "Press Submission"}.`] },
      },
      { status: 400 }
    );
  }

  const articleType = articleTypeToDb(payload.articleType);
  const articleTypeOther = articleType === "Other" ? payload.articleTypeOther || null : null;
  const outletId = await resolveOutletId(prisma, projectId, payload.outlet);

  if (isCoverage) {
    const updated = await prisma.pressCoverage.update({
      where: { id: params.id },
      data: {
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
    return NextResponse.json(normalizeCoverage(updated));
  }

  const status = submissionStatusToDb(payload.status);
  const updated = await prisma.pressSubmission.update({
    where: { id: params.id },
    data: {
      title: payload.title,
      outlet: payload.outlet,
      outletId,
      articleType,
      articleTypeOther,
      status,
      dateSubmitted: submissionDate(status, payload.dateSubmitted, existingSubmission?.dateSubmitted),
      responsiblePerson: payload.responsiblePerson || null,
      followUpDate: dateOrNull(payload.followUpDate),
      draftUrl: payload.documentUrl || null,
      publishedArticleUrl: payload.articleUrl || null,
      notes: payload.notes || null,
      coverageId: payload.linkedCoverageId || null,
    },
  });
  return NextResponse.json(normalizeSubmission(updated));
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { projectId, error } = await requireProjectAccess(request, { allowAgents: false });
  if (error) return error;

  const [submission, coverage] = await Promise.all([
    prisma.pressSubmission.findFirst({ where: { id: params.id, projectId }, select: { id: true } }),
    prisma.pressCoverage.findFirst({ where: { id: params.id, projectId }, select: { id: true } }),
  ]);
  if (!submission && !coverage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (submission) await prisma.pressSubmission.delete({ where: { id: params.id } });
  if (coverage) await prisma.pressCoverage.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
