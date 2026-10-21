import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/projects/OnboardingShell";
import { CreateProjectForm } from "@/components/projects/ProjectForms";
import { listUserProjects } from "@/lib/projects";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/");
  const hasProjects = (await listUserProjects(userId)).length > 0;

  return (
    <OnboardingShell
      title="Create a project"
      description="A project holds your team's goals, agents and points. Everyone you invite works in it together."
    >
      <CreateProjectForm />
      <p className="m-0 text-center text-sm text-muted-foreground">
        Got a code?{" "}
        <Link href="/projects/join" className="font-semibold text-primary-deep underline-offset-2 hover:underline">
          Join a project
        </Link>
        {hasProjects && (
          <>
            {" "}·{" "}
            <Link href="/dashboard" className="font-semibold text-primary-deep underline-offset-2 hover:underline">
              Back to your projects
            </Link>
          </>
        )}
      </p>
    </OnboardingShell>
  );
}
