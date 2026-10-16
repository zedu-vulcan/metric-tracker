"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/AuthButtons";

interface DashboardSidebarProps {
  email: string | null | undefined;
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="5" height="5" rx="1.5" />
      <rect x="8" y="1" width="5" height="5" rx="1.5" />
      <rect x="1" y="8" width="5" height="5" rx="1.5" />
      <rect x="8" y="8" width="5" height="5" rx="1.5" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <line x1="1" y1="3.5" x2="13" y2="3.5" />
      <line x1="1" y1="7" x2="13" y2="7" />
      <line x1="1" y1="10.5" x2="13" y2="10.5" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M1 4a1 1 0 0 1 1-1h3l1.5 2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard",             label: "Overview",     icon: IconGrid,   exact: true },
  { href: "/dashboard/submissions", label: "Submissions",  icon: IconList,   exact: false },
  { href: "/dashboard/directories", label: "Directories",  icon: IconFolder, exact: false },
];

export function DashboardSidebar({ email }: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const linkClass = (href: string, exact: boolean) => {
    const active = isActive(href, exact);
    return [
      "flex items-center gap-2 px-[10px] py-[7px] rounded-[7px] text-[13px] font-medium no-underline transition-[color,background-color] duration-[120ms] whitespace-nowrap overflow-hidden max-[980px]:flex-shrink-0",
      active
        ? "text-violet-deep bg-white/[0.64] font-semibold rounded-l-none shadow-[inset_2px_0_0_#8e6afa] pl-2 max-[980px]:rounded-[7px] max-[980px]:shadow-none max-[980px]:pl-[10px] max-[980px]:bg-violet-tint"
        : "text-muted hover:text-ink hover:bg-white/[0.64]",
    ].join(" ");
  };

  return (
    <aside className="flex flex-col sticky top-0 h-screen overflow-y-auto py-5 px-[10px] pb-4 border-r border-line bg-sidebar-bg max-[980px]:static max-[980px]:h-auto max-[980px]:flex-row max-[980px]:items-center max-[980px]:py-[14px] max-[980px]:px-4 max-[980px]:border-r-0 max-[980px]:border-b max-[980px]:overflow-x-auto max-[980px]:gap-1">
      <div className="py-0.5 px-2 mb-6 flex-shrink-0 max-[980px]:mb-0 max-[980px]:mr-5">
        <a className="inline-flex items-center gap-[9px] text-ink text-[14px] font-bold tracking-[-0.03em] no-underline" href="/dashboard">
          <span className="wordmark-mark" aria-hidden="true">
            <i /><i /><i />
          </span>
          Metric Tracker
        </a>
      </div>

      <nav aria-label="Main navigation" className="flex flex-col max-[980px]:flex-row max-[980px]:gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <a key={href} className={linkClass(href, exact)} href={href}>
            <Icon />
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis">{label}</span>
          </a>
        ))}
      </nav>

      <div className="grid gap-[6px] mt-auto pt-[14px] px-[10px] border-t border-line flex-shrink-0 max-[980px]:hidden">
        <span className="text-muted text-[11px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" title={email ?? undefined}>
          {email}
        </span>
        <SignOutButton />
      </div>
    </aside>
  );
}
