import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/projects/OnboardingShell";
import { JoinProjectForm } from "@/components/projects/ProjectForms";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function JoinProjectPage() {
  if (!(await sessionUserId())) redirect("/");

  return (
    <OnboardingShell title="Join a project" description="Enter the code the project's owner or an admin shared with you.">
      <JoinProjectForm />
      <p className="m-0 text-center text-sm text-muted-foreground">
        Starting something new?{" "}
        <Link href="/projects/new" className="font-semibold text-primary-deep underline-offset-2 hover:underline">
          Create a project
        </Link>
      </p>
    </OnboardingShell>
  );
}
