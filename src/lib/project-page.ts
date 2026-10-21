import { cache } from "react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in person and the project a `/p/[slug]` page shows, for server components.
 * Signed out → sign-in; not a member (or no such project) → 404. Cached per request,
 * so the layout and the page share one lookup.
 */
export const getProjectPage = cache(async (slug: string) => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) redirect("/");

  const membership = await prisma.projectMember.findFirst({
    where: { userId, project: { slug } },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) notFound();

  return {
    session,
    userId,
    project: { ...membership.project, role: membership.role },
  };
});
