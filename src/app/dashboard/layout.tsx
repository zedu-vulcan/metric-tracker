import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  return (
    <div className="grid grid-cols-[224px_minmax(0,1fr)] min-h-screen max-[980px]:grid-cols-1">
      <DashboardSidebar email={session.user.email} />
      {children}
    </div>
  );
}
