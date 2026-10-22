"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  NewspaperIcon,
  ScanSearchIcon,
  SettingsIcon,
  TargetIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/components/projects/ProjectProvider";
import { cn } from "@/lib/utils";

const NAV_ITEM =
  "group/nav flex h-11 shrink-0 items-center gap-3 rounded-full px-4 text-[15px] font-medium whitespace-nowrap text-sidebar-muted-foreground no-underline transition-[color,background-color,box-shadow] duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-5 [&_svg]:shrink-0";
const NAV_ITEM_CURRENT =
  "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_8px_20px_rgb(125_104_249/0.35)] hover:bg-sidebar-primary hover:text-sidebar-primary-foreground";

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
        "aria-[current=page]:bg-sidebar-primary aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary-foreground aria-[current=page]:shadow-[0_8px_20px_rgb(125_104_249/0.35)]",
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
    </a>
  );
}

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Marketing channels, grouped under one expandable "Marketing" item. Paths are inside the current project. */
const MARKETING_CHANNELS: NavItem[] = [
  { href: "/content", label: "Content", icon: FileTextIcon },
  { href: "/directories", label: "Directories", icon: FolderOpenIcon },
  { href: "/seo", label: "SEO checker", icon: ScanSearchIcon },
  { href: "/media", label: "Press & Media", icon: NewspaperIcon },
];

/** Top-level items shown after the Marketing group. */
const CHANNELS: NavItem[] = [
  { href: "/goals", label: "Goals", icon: TargetIcon },
  { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
  { href: "/guide", label: "How Amp works", icon: BookOpenIcon },
  { href: "/settings", label: "Project settings", icon: SettingsIcon },
];

export function DashboardSidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { href: projectPath } = useProject();
  const overview = projectPath();
  const isCurrent = (href: string) => (href === overview ? pathname === href : pathname.startsWith(href));
  const current = (href: string) => (isCurrent(href) ? "page" : undefined);
  const inProject = (items: NavItem[]) => items.map((item) => ({ ...item, href: projectPath(item.href) }));

  return (
    <SidebarNavList aria-label="Main navigation">
      <SidebarNavLink
        aria-current={current(overview)}
        href={overview}
        collapsed={collapsed}
        icon={<LayoutDashboardIcon aria-hidden="true" />}
      >
        Overview
      </SidebarNavLink>
      <span aria-hidden="true" className="mx-3 my-1.5 h-px shrink-0 bg-sidebar-border" />
      <SidebarNavGroup
        label="Marketing"
        icon={MegaphoneIcon}
        items={inProject(MARKETING_CHANNELS)}
        collapsed={collapsed}
        isCurrent={isCurrent}
      />
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

type SidebarNavGroupProps = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  collapsed: boolean;
  isCurrent: (href: string) => boolean;
};

/**
 * A nav item that holds other items. On the full sidebar it expands in place;
 * on the collapsed sidebar there's no room, so it opens a menu instead.
 */
function SidebarNavGroup({ label, icon: Icon, items, collapsed, isCurrent }: SidebarNavGroupProps) {
  const active = items.some((item) => isCurrent(item.href));
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (collapsed) return <GroupMenu label={label} icon={Icon} items={items} active={active} isCurrent={isCurrent} />;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
      <CollapsibleTrigger className={cn(NAV_ITEM, active && !open && NAV_ITEM_CURRENT, active && open && "text-sidebar-foreground")}>
        <Icon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDownIcon aria-hidden="true" className={cn("opacity-70 transition-transform duration-150", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 ml-6 flex flex-col gap-1.5 border-l border-sidebar-border pl-2.5">
          {items.map(({ href, label: itemLabel, icon: ItemIcon }) => (
            <SidebarNavLink
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              icon={<ItemIcon aria-hidden="true" />}
              className="h-10 text-sm"
            >
              {itemLabel}
            </SidebarNavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The group as an icon that opens a menu beside the collapsed sidebar. */
function GroupMenu({
  label,
  icon: Icon,
  items,
  active,
  isCurrent,
}: Omit<SidebarNavGroupProps, "collapsed"> & { active: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className={cn(NAV_ITEM, active && NAV_ITEM_CURRENT, "size-11 justify-center self-center px-0")}
      >
        <Icon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {items.map(({ href, label: itemLabel, icon: ItemIcon }) => (
          <DropdownMenuItem key={href} asChild>
            <a href={href} aria-current={isCurrent(href) ? "page" : undefined} className="aria-[current=page]:font-semibold">
              <ItemIcon aria-hidden="true" />
              {itemLabel}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
