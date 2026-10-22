import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { exportDatabaseData, exportDatabaseSpreadsheet } from "@/lib/admin-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, error: authError } = await requireUser(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || request.headers.get("x-project-id");
  const format = (searchParams.get("format") || "json").toLowerCase();

  try {
    const data = await exportDatabaseData(prisma, {
      userId: user.id,
      projectId: projectId || undefined,
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const slug = data.projects.length === 1 && data.projects[0] ? data.projects[0].slug : "all";

    if (format === "xlsx" || format === "sheet" || format === "excel" || format === "spreadsheet") {
      const spreadsheetBuffer = await exportDatabaseSpreadsheet(data);
      const filename = `backup-${slug}-${dateStr}.xlsx`;

      return new NextResponse(new Uint8Array(spreadsheetBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const filename = `backup-${slug}-${dateStr}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export data";
    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
