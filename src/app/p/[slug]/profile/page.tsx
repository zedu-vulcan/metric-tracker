import { notFound } from "next/navigation";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { ProfileView } from "@/components/profile/ProfileView";
import { prisma } from "@/lib/prisma";
import { getProjectPage } from "@/lib/project-page";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { slug: string } }) {
  const { userId, project } = await getProjectPage(params.slug);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
      _count: { select: { agents: { where: { projectId: project.id } } } },
    },
  });
  if (!user) notFound();

  return (
    <>
      <PageHeader title="Profile" description="Your details, your agents and your notifications." />
      <PageContent>
        <ProfileView
          profile={{
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified !== null,
            providers: user.accounts.map((account) => account.provider),
            agentCount: user._count.agents,
          }}
        />
      </PageContent>
    </>
  );
}
