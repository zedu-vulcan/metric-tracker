import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { UpdateSubmissionBodySchema } from "@/lib/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const result = UpdateSubmissionBodySchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { status, listingUrl, submittedAt } = result.data;
  const data: Parameters<typeof prisma.submission.update>[0]["data"] = {};

  if (status !== undefined) {
    data.status = status;
    if (status === "submitted" && submittedAt === undefined) {
      data.submittedAt = new Date();
    }
  }
  if (listingUrl !== undefined) data.listingUrl = listingUrl;
  if (submittedAt !== undefined) data.submittedAt = submittedAt ? new Date(submittedAt) : null;

  const submission = await prisma.submission.update({
    where: { id: params.id },
    data,
    include: {
      directory: {
        select: { id: true, name: true, url: true, list: { select: { id: true, name: true } } },
      },
      _count: { select: { traffic: true } },
    },
  });

  return NextResponse.json(submission);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAuth();
  if (error) return error;

  await prisma.submission.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
