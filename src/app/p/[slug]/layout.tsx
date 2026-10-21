import { AppSidebar } from "@/components/AppSidebar";
import { AgentsProvider } from "@/components/agents/AgentsProvider";
import { GoalsProvider } from "@/components/goals/GoalsProvider";
import { ProjectProvider } from "@/components/projects/ProjectProvider";
import { TopBar } from "@/components/TopBar";
import { getProjectPage } from "@/lib/project-page";
import { listUserProjects } from "@/lib/projects";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "Z";
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const { session, userId, project } = await getProjectPage(params.slug);
  const projects = (await listUserProjects(userId)).map(({ project: other, role }) => ({ ...other, role }));

  const displayName = session.user?.name ?? session.user?.email ?? "Signed in";

  return (
    // Keyed by project, so switching projects starts every store fresh.
    <ProjectProvider key={project.id} project={project}>
      <main className="grid min-h-screen lg:grid-cols-[auto_minmax(0,1fr)]">
        <AppSidebar projects={projects} />
        <GoalsProvider
          currentUser={{ id: userId, name: session.user?.name ?? "You", image: session.user?.image ?? undefined }}
        >
          <AgentsProvider>
            <div className="flex min-h-screen min-w-0 flex-col">
              <TopBar
                name={displayName}
                email={session.user?.email ?? undefined}
                image={session.user?.image ?? undefined}
                initials={initials(displayName)}
              />
              {children}
            </div>
          </AgentsProvider>
        </GoalsProvider>
      </main>
    </ProjectProvider>
  );
}
