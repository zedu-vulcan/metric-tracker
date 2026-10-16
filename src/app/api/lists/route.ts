import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { ListBodySchema } from "@/lib/schemas";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const lists = await prisma.list.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { directories: true } } },
  });

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const result = ListBodySchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const list = await prisma.list.create({ data: result.data });
  return NextResponse.json(list, { status: 201 });
}
