import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/api";
import { goalTaskCreateSchema } from "@/lib/schemas/tasks";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    // 1. Authenticate caller (supports both human users and agents)
    const auth = await getAuthContext(req);
    if (auth.error) {
      return auth.error;
    }

    const workstreamId = params.id;

    // 2. Verify parent workstream exists and is accepted
    const workstream = await prisma.workstream.findUnique({
      where: { id: workstreamId },
    });

    if (!workstream) {
      return NextResponse.json(
        { error: "Workstream not found" },
        { status: 404 },
      );
    }

    // Rule: Tasks cannot be proposed under an unaccepted idea/workstream
    if (workstream.status !== "accepted") {
      return NextResponse.json(
        { error: "Cannot propose tasks under an unaccepted idea" },
        { status: 400 },
      );
    }

    // 3. Parse and validate request body using Zod schema
    const body = await req.json();
    const result = goalTaskCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      );
    }

    const { title, description, taskType } = result.data;

    // 4. Determine initial status based on workstream's autoAcceptTasks setting
    const initialStatus = workstream.autoAcceptTasks ? "open" : "proposed";

    // 5. Create the task record
    const newTask = await prisma.task.create({
      data: {
        workstreamId,
        title,
        description: description ?? null,
        taskType,
        status: initialStatus,
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
