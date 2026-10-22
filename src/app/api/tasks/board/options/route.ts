import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/projects";
import { createTaskBoardOptionsHandler } from "@/lib/task-board-api";
import { listTaskBoardOptions, prismaTaskBoardStore } from "@/lib/task-board-query";

export const dynamic = "force-dynamic";

export const GET = createTaskBoardOptionsHandler({
  requireAccess: requireProjectAccess,
  options: (context) => prisma.$transaction(
    (tx) => listTaskBoardOptions(prismaTaskBoardStore(tx), context),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  ),
});
