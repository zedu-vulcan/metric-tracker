import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { createTaskBoardListHandler } from "@/lib/task-board-api";
import { listTaskBoard, prismaTaskBoardStore } from "@/lib/task-board-query";

export const dynamic = "force-dynamic";

export const GET = createTaskBoardListHandler({
  requireAccess: requireProjectAccess,
  list: (context, query) => prisma.$transaction(
    (tx) => listTaskBoard(prismaTaskBoardStore(tx), context, query),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  ),
});
