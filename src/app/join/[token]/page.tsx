import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/AuthButtons";
import { OnboardingShell } from "@/components/projects/OnboardingShell";
import { AcceptInviteButton } from "@/components/projects/ProjectForms";
import { projectHref } from "@/lib/project-paths";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

/** An invite link. Signed-out people sign in first and come back here; members go straight in. */
export default async function InvitePage({ params }: { params: { token: string } }) {
  const project = await prisma.project.findUnique({
    where: { inviteToken: params.token },
    select: { id: true, name: true, slug: true, _count: { select: { members: true } } },
  });

  if (!project) {
    return (
      <OnboardingShell
        title="This invite link has expired"
        description="The project's owner or an admin may have replaced it. Ask them for a new link or the project code."
      >
        <Link
          href="/projects/join"
          className="text-center text-sm font-semibold text-primary-deep underline-offset-2 hover:underline"
        >
          Join with a code instead
        </Link>
      </OnboardingShell>
    );
  }

  const userId = await sessionUserId();
  if (userId) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId } },
    });
    if (membership) redirect(projectHref(project.slug));
  }

  const people = `${project._count.members} ${project._count.members === 1 ? "person" : "people"}`;

  return (
    <OnboardingShell title={`Join ${project.name}`} description={`You've been invited to ${project.name} on Zedu Amp (${people}).`}>
      {userId ? (
        <AcceptInviteButton token={params.token} projectName={project.name} />
      ) : (
        <SignInButton callbackUrl={`/join/${params.token}`} />
      )}
    </OnboardingShell>
  );
}
