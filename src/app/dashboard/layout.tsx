import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/AuthButtons";
import { DashboardSidebarNav } from "@/components/SidebarNav";
import { Wordmark } from "@/components/Wordmark";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  return (
    <main className="grid min-h-screen lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="flex items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-4 py-3.5 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2.5 lg:pt-5 lg:pb-4">
        <div className="mr-5 shrink-0 px-2 py-0.5 lg:mr-0 lg:mb-6">
          <Wordmark href="/dashboard" />
        </div>

        <DashboardSidebarNav />

        <div className="mt-auto hidden shrink-0 gap-1.5 border-t border-sidebar-border px-2.5 pt-3.5 lg:grid">
          <span
            className="truncate text-[11px] font-medium text-muted-foreground"
            title={session.user.email ?? undefined}
          >
            {session.user.email}
          </span>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">{children}</div>
    </main>
  );
}
