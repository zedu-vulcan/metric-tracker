import { NextResponse } from "next/server";
import { parseTaskBoardQuery } from "@/lib/schemas/task-board";
import type { listTaskBoard, listTaskBoardOptions } from "@/lib/task-board-query";

type Access = {
  projectId: string | null;
  user: { id: string } | null;
  error: Response | null;
};
type Context = { projectId: string; userId: string };
type Dependencies = {
  requireAccess(request: Request, options: { allowAgents: false }): Promise<Access>;
  list(context: Context, query: Parameters<typeof listTaskBoard>[2]): ReturnType<typeof listTaskBoard>;
  options(context: Context): ReturnType<typeof listTaskBoardOptions>;
};

/** Testable HTTP boundary; real routes inject the existing project-access helper. */
export function createTaskBoardListHandler(dependencies: Pick<Dependencies, "requireAccess" | "list">) {
  return async function GET(request: Request) {
    const { projectId, user, error } = await dependencies.requireAccess(request, { allowAgents: false });
    if (error) return error;
    if (!projectId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = parseTaskBoardQuery(new URL(request.url).searchParams);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const result = await dependencies.list({ projectId, userId: user.id }, parsed.data);
    return result.status === "ok" ? NextResponse.json(result.data) : NextResponse.json({ error: "Not found" }, { status: 404 });
  };
}

export function createTaskBoardOptionsHandler(dependencies: Pick<Dependencies, "requireAccess" | "options">) {
  return async function GET(request: Request) {
    const { projectId, user, error } = await dependencies.requireAccess(request, { allowAgents: false });
    if (error) return error;
    if (!projectId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await dependencies.options({ projectId, userId: user.id });
    return result.status === "ok" ? NextResponse.json(result.data) : NextResponse.json({ error: "Not found" }, { status: 404 });
  };
}
