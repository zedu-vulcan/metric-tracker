import { PageContent, PageHeader } from "@/components/PageHeader";
import { ProjectSettings } from "@/components/projects/ProjectSettings";
import { prisma } from "@/lib/prisma";
import { getProjectPage } from "@/lib/project-page";
import { serializeProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 };

export default async function ProjectSettingsPage({ params }: { params: { slug: string } }) {
  const { userId, project } = await getProjectPage(params.slug);

  const [record, members] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
    prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="Project settings" description="Who's in this project, and how new people join." />
      <PageContent>
        <ProjectSettings
          currentUserId={userId}
          project={serializeProject(record, project.role, members.length)}
          members={members
            .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
            .map((member) => ({
              userId: member.userId,
              name: member.user.name,
              email: member.user.email,
              role: member.role,
              joinedAt: member.joinedAt.toISOString(),
            }))}
        />
      </PageContent>
    </>
  );
}
