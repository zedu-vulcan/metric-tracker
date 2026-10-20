import { NextResponse } from "next/server";
import { taskIdParamsSchema } from "@/lib/schemas/tasks";

type TaskStatusRecord = { id: string; status: string };

type TaskAcceptanceDependencies = {
  requireUser: (request: Request) => Promise<{ error: NextResponse | null }>;
  findTask: (id: string) => Promise<TaskStatusRecord | null>;
  acceptProposedTask: (id: string) => Promise<number>;
};

export function createTaskAcceptanceHandler(dependencies: TaskAcceptanceDependencies) {
  return async function POST(request: Request, params: { id: string }) {
    const { error } = await dependencies.requireUser(request);
    if (error) return error;

    const paramsResult = taskIdParamsSchema.safeParse(params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: paramsResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id } = paramsResult.data;
    const task = await dependencies.findTask(id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (task.status !== "proposed") {
      return NextResponse.json({ error: "Task is not proposed" }, { status: 400 });
    }

    const updatedCount = await dependencies.acceptProposedTask(id);
    if (updatedCount === 0) {
      const currentTask = await dependencies.findTask(id);
      if (!currentTask) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Task is not proposed" }, { status: 400 });
    }

    return NextResponse.json({ id, status: "open" });
  };
}
