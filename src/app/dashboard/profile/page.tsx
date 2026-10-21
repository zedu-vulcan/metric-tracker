import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { PageContent, PageHeader } from "@/components/PageHeader";
import { ProfileView } from "@/components/profile/ProfileView";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
      _count: { select: { agents: true } },
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
