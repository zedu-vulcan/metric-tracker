import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/projects/OnboardingShell";
import { JoinProjectForm } from "@/components/projects/ProjectForms";
import { listUserProjects } from "@/lib/projects";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function JoinProjectPage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/");
  const hasProjects = (await listUserProjects(userId)).length > 0;

  return (
    <OnboardingShell title="Join a project" description="Enter the code the project's owner or an admin shared with you.">
      <JoinProjectForm />
      <p className="m-0 text-center text-sm text-muted-foreground">
        Starting something new?{" "}
        <Link href="/projects/new" className="font-semibold text-primary-deep underline-offset-2 hover:underline">
          Create a project
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
