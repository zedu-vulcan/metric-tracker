"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, MenuIcon, XIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { DashboardSidebarNav } from "@/components/SidebarNav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark, Wordmark } from "@/components/Wordmark";
import { PointsTotal } from "@/components/tasks/PointsTotal";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "zedu-amp:sidebar-collapsed";

/** The desktop sidebar. Below `lg` the same navigation opens from the top bar as `MobileNav`. */
export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { href } = useProject();

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
        "sticky top-0 hidden h-screen flex-col overflow-y-auto bg-sidebar py-6 text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[84px] px-3" : "w-[248px] px-4"
      )}
    >
      <div className={cn("mb-9 flex shrink-0 items-center", collapsed ? "flex-col gap-4" : "justify-between pl-2")}>
        {collapsed ? (
          <a href={href("/tasks")} aria-label="Amp tasks" className="flex">
            <BrandMark className="size-8" />
          </a>
        ) : (
          <Wordmark href={href()} tone="inverse" className="text-[17px] [&_svg]:size-8" />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border text-sidebar-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ChevronLeftIcon className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      <DashboardSidebarNav collapsed={collapsed} />
    </aside>
  );
}

/** The sidebar as a slide-in panel on phones and tablets, opened from the top bar. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { href, name } = useProject();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2 shrink-0 lg:hidden">
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-0 bg-sidebar px-4 py-5 text-sidebar-foreground data-[side=left]:w-[288px] data-[side=left]:max-w-[85vw] data-[side=left]:border-sidebar-border"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Pages in {name}</SheetDescription>
        <div className="mb-7 flex shrink-0 items-center justify-between pl-2">
          <Wordmark href={href()} tone="inverse" className="text-[17px] [&_svg]:size-8" />
          <SheetClose
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-full text-sidebar-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </SheetClose>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          <DashboardSidebarNav />
        </div>
        <a
          href={href("/scoreboard")}
          className="mt-4 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-sidebar-accent py-2 pr-2 pl-4 text-sm font-semibold text-sidebar-foreground outline-none hover:bg-sidebar-border focus-visible:ring-2 focus-visible:ring-sidebar-ring sm:hidden"
        >
          Scoreboard
          <PointsTotal />
        </a>
      </SheetContent>
    </Sheet>
  );
}
