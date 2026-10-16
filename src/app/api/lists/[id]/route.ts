import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAuth();
  if (error) return error;

  await prisma.list.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
