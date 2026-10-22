"use client";

import { usePathname } from "next/navigation";
import {
  BriefcaseBusinessIcon,
  ListTodoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { useNotifications } from "@/components/profile/useNotifications";
import { useProject } from "@/components/projects/ProjectProvider";
import { cn } from "@/lib/utils";

const NAV_ITEM =
  "group/nav flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-[15px] font-medium whitespace-nowrap text-sidebar-muted-foreground no-underline transition-[color,background-color,box-shadow] duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-5 [&_svg]:shrink-0";

export function SidebarNavList({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return <nav className={cn("flex shrink-0 flex-col items-stretch gap-1.5", className)} {...props} />;
}

interface SidebarNavLinkProps extends React.ComponentProps<"a"> {
  icon: React.ReactNode;
  badge?: React.ReactNode;
  collapsed?: boolean;
}

export function SidebarNavLink({ icon, badge, collapsed = false, children, className, ...props }: SidebarNavLinkProps) {
  return (
    <a
      title={collapsed && typeof children === "string" ? children : undefined}
      className={cn(
        NAV_ITEM,
        "relative aria-[current=page]:bg-sidebar-primary aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary-foreground aria-[current=page]:shadow-[0_8px_20px_rgb(125_104_249/0.35)]",
        collapsed && "size-11 justify-center self-center px-0",
        className
      )}
      {...props}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{children}</span>
      {badge != null && !collapsed && (
        <span className="ml-auto shrink-0 rounded-full bg-sidebar-accent px-2 text-xs font-semibold text-sidebar-foreground group-aria-[current=page]/nav:bg-white/20">
          {badge}
        </span>
      )}
      {/* The collapsed rail has no room for a number, so a dot says something is waiting. */}
      {badge != null && collapsed && (
        <span className="absolute top-2 right-2 size-2.5 rounded-full bg-warning ring-2 ring-sidebar">
          <span className="sr-only">{badge} waiting</span>
        </span>
      )}
    </a>
  );
}

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Top-level items shown after the divider. */
const CHANNELS: NavItem[] = [];

export function DashboardSidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { href: projectPath } = useProject();
  const { actionCount } = useNotifications();
  const tasks = projectPath("/tasks");
  const yourMove = projectPath("/todo");
  const current = (href: string) => (pathname.startsWith(href) ? "page" : undefined);
  const inProject = (items: NavItem[]) => items.map((item) => ({ ...item, href: projectPath(item.href) }));

  return (
    <SidebarNavList aria-label="Main navigation">
      <SidebarNavLink
        aria-current={current(tasks)}
        href={tasks}
        collapsed={collapsed}
        icon={<ListTodoIcon aria-hidden="true" />}
      >
        Tasks
      </SidebarNavLink>
      <SidebarNavLink
        aria-current={current(yourMove)}
        href={yourMove}
        collapsed={collapsed}
        icon={<TriangleAlertIcon aria-hidden="true" />}
        badge={actionCount > 0 ? (actionCount > 99 ? "99+" : actionCount) : undefined}
      >
        Escalations
      </SidebarNavLink>
      <SidebarNavLink
        aria-current={current(projectPath("/work"))}
        href={projectPath("/work")}
        collapsed={collapsed}
        icon={<BriefcaseBusinessIcon aria-hidden="true" />}
      >
        My Work
      </SidebarNavLink>
      {CHANNELS.length > 0 && <span aria-hidden="true" className="mx-3 my-1.5 h-px shrink-0 bg-sidebar-border" />}
      {inProject(CHANNELS).map(({ href, label, icon: Icon }) => (
        <SidebarNavLink
          key={href}
          aria-current={current(href)}
          href={href}
          collapsed={collapsed}
          icon={<Icon aria-hidden="true" />}
        >
          {label}
        </SidebarNavLink>
      ))}
    </SidebarNavList>
  );
}
