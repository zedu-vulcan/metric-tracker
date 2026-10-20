"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { DashboardSidebarNav } from "@/components/SidebarNav";
import { BrandMark, Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "zedu-amp:sidebar-collapsed";

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage can be unavailable; the sidebar just starts expanded.
    }
  }, []);

  const toggle = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      } catch {
        // Not critical if the preference can't be saved.
      }
      return !value;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 overflow-x-auto bg-sidebar px-4 py-2.5 text-sidebar-foreground",
        "lg:h-screen lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:py-6 lg:transition-[width] lg:duration-200",
        collapsed ? "lg:w-[84px] lg:px-3" : "lg:w-[248px] lg:px-4"
      )}
    >
      <div className={cn("flex shrink-0 items-center lg:mb-9", collapsed ? "lg:flex-col lg:gap-4" : "lg:justify-between lg:pl-2")}>
        {collapsed ? (
          <a href="/dashboard" aria-label="Zedu Amp overview" className="hidden lg:flex">
            <BrandMark className="size-8" />
          </a>
        ) : null}
        <Wordmark href="/dashboard" tone="inverse" className={cn("text-[17px] [&_svg]:size-8", collapsed && "lg:hidden")} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden size-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border text-sidebar-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:flex"
        >
          <ChevronLeftIcon className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      <DashboardSidebarNav collapsed={collapsed} />
    </aside>
  );
}
