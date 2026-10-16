import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { DirectoryBodySchema } from "@/lib/schemas";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const directories = await prisma.directory.findMany({
    orderBy: [{ list: { name: "asc" } }, { name: "asc" }],
    include: {
      list: { select: { id: true, name: true } },
      submission: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json(directories);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const result = DirectoryBodySchema.safeParse(await req.json());
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, url, listId } = result.data;

  const directory = await prisma.directory.create({
    data: { name, url: url || null, listId },
    include: { list: { select: { id: true, name: true } } },
  });

  return NextResponse.json(directory, { status: 201 });
}
