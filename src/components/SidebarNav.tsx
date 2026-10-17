"use client";

import { FolderGit2Icon, TrendingUpIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarNavList({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return <nav className={cn("flex shrink-0 gap-1 lg:flex-col lg:gap-0", className)} {...props} />;
}

interface SidebarNavLinkProps extends React.ComponentProps<"a"> {
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

/** `/dashboard` matches only itself; other links also match their sub-pages. */
function isCurrent(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavLink({ icon, badge, children, className, href, ...props }: SidebarNavLinkProps) {
  const pathname = usePathname();
  return (
    <a
      href={href}
      aria-current={isCurrent(pathname, href) ? "page" : undefined}
      className={cn(
        "group/nav flex shrink-0 items-center gap-2 overflow-hidden rounded-[7px] px-2.5 py-1.75 text-[13px] font-medium whitespace-nowrap text-muted-foreground no-underline transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        "aria-[current=page]:bg-transparent aria-[current=page]:font-semibold aria-[current=page]:text-primary-deep",
        "lg:aria-[current=page]:rounded-none lg:aria-[current=page]:pl-2.5 lg:aria-[current=page]:shadow-[inset_2px_0_0_var(--primary)]",
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge != null && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 font-mono text-2xs/[1.7] font-medium text-muted-foreground group-aria-[current=page]/nav:bg-accent group-aria-[current=page]/nav:text-primary-deep">
          {badge}
        </span>
      )}
    </a>
  );
}

export function DashboardSidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarNavList aria-label="Main navigation">
      <SidebarNavLink aria-current={pathname === "/dashboard" ? "page" : undefined} href="/dashboard" icon={<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12.5V6.5a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm9 5V9.5a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2ZM4 18.5v-3.5a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>}>
        Overview
      </SidebarNavLink>
      <SidebarNavLink aria-current={pathname.startsWith("/dashboard/content") ? "page" : undefined} href="/dashboard/content" icon={<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 4.5h7l4 4V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Zm7 0v4h4" /><path d="M8.5 12h7M8.5 15.5h7" /></svg>}>
        Content
      </SidebarNavLink>
      <SidebarNavLink href="/dashboard/directories" icon={<FolderGit2Icon aria-hidden="true" />}>
        Directories
      </SidebarNavLink>
      <SidebarNavLink href="/dashboard/seo" icon={<TrendingUpIcon aria-hidden="true" />}>
        SEO Analytics
      </SidebarNavLink>
    </SidebarNavList>
  );
}
