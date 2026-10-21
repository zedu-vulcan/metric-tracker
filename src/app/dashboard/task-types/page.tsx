import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { TaskTypesView } from "@/components/task-types/TaskTypesView";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Platform admins only: non-admins are redirected to the dashboard.
 * The gate is a server-side check of `User.is_platform_admin`. Until unit 0
 * applies the migration adding that column, the query fails and everyone is
 * treated as a non-admin (redirected) — that is the honest behavior of the
 * real gate, not a demo fallback.
 */
export default async function TaskTypesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect("/dashboard");

  let isAdmin = false;
  try {
    const rows = await prisma.$queryRaw<{ is_platform_admin: boolean }[]>`
      SELECT is_platform_admin FROM "User" WHERE id = ${userId} LIMIT 1`;
    isAdmin = rows[0]?.is_platform_admin ?? false;
  } catch {
    isAdmin = false;
  }
  if (!isAdmin) redirect("/dashboard");

  return <TaskTypesView />;
}
