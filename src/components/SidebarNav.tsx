"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDownIcon,
  FileTextIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  NewspaperIcon,
  ScanSearchIcon,
  TargetIcon,
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
import { cn } from "@/lib/utils";

const NAV_ITEM =
  "group/nav flex h-9 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-sidebar-muted-foreground no-underline transition-[color,background-color,box-shadow] duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:shrink-0 lg:h-11 lg:gap-3 lg:px-4 lg:text-[15px] lg:[&_svg]:size-5";
const NAV_ITEM_CURRENT =
  "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_8px_20px_rgb(125_104_249/0.35)] hover:bg-sidebar-primary hover:text-sidebar-primary-foreground";

export function SidebarNavList({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return <nav className={cn("flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-1.5", className)} {...props} />;
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
        collapsed && "lg:size-11 lg:justify-center lg:self-center lg:px-0",
        className
      )}
      {...props}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", collapsed && "lg:sr-only")}>{children}</span>
      {badge != null && !collapsed && (
        <span className="ml-auto shrink-0 rounded-full bg-sidebar-accent px-2 text-xs font-semibold text-sidebar-foreground group-aria-[current=page]/nav:bg-white/20">
          {badge}
        </span>
      )}
    </a>
  );
}

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Marketing channels, grouped under one expandable "Marketing" item. */
const MARKETING_CHANNELS: NavItem[] = [
  { href: "/dashboard/content", label: "Content", icon: FileTextIcon },
  { href: "/dashboard/directories", label: "Directories", icon: FolderOpenIcon },
  { href: "/dashboard/seo", label: "SEO checker", icon: ScanSearchIcon },
  { href: "/dashboard/media", label: "Press & Media", icon: NewspaperIcon },
];

/** Top-level items shown after the Marketing group. */
const CHANNELS: NavItem[] = [{ href: "/dashboard/goals", label: "Goals", icon: TargetIcon }];

export function DashboardSidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const current = (href: string) => (isCurrent(href) ? "page" : undefined);

  return (
    <SidebarNavList aria-label="Main navigation">
      <SidebarNavLink
        aria-current={current("/dashboard")}
        href="/dashboard"
        collapsed={collapsed}
        icon={<LayoutDashboardIcon aria-hidden="true" />}
      >
        Overview
      </SidebarNavLink>
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-sidebar-border lg:mx-3 lg:my-1.5 lg:h-px lg:w-auto" />
      <SidebarNavGroup label="Marketing" icon={MegaphoneIcon} items={MARKETING_CHANNELS} collapsed={collapsed} isCurrent={isCurrent} />
      {CHANNELS.map(({ href, label, icon: Icon }) => (
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
 * A nav item that holds other items. On the full desktop sidebar it expands in place;
 * on the mobile bar and the collapsed sidebar there's no room, so it opens a menu instead.
 */
function SidebarNavGroup({ label, icon: Icon, items, collapsed, isCurrent }: SidebarNavGroupProps) {
  const active = items.some((item) => isCurrent(item.href));
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <>
      <GroupMenu label={label} icon={Icon} items={items} active={active} isCurrent={isCurrent} className="lg:hidden" />
      {collapsed ? (
        <GroupMenu
          label={label}
          icon={Icon}
          items={items}
          active={active}
          isCurrent={isCurrent}
          iconOnly
          side="right"
          className="hidden lg:flex lg:size-11 lg:justify-center lg:self-center lg:px-0"
        />
      ) : (
        <Collapsible open={open} onOpenChange={setOpen} className="hidden lg:flex lg:flex-col">
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
                  className="lg:h-10 lg:text-sm"
                >
                  {itemLabel}
                </SidebarNavLink>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

function GroupMenu({
  label,
  icon: Icon,
  items,
  active,
  isCurrent,
  iconOnly = false,
  side = "bottom",
  className,
}: Omit<SidebarNavGroupProps, "collapsed"> & {
  active: boolean;
  iconOnly?: boolean;
  side?: "bottom" | "right";
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={cn(NAV_ITEM, active && NAV_ITEM_CURRENT, className)}
      >
        <Icon aria-hidden="true" />
        {!iconOnly && (
          <>
            <span>{label}</span>
            <ChevronDownIcon aria-hidden="true" className="opacity-70" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-52">
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
