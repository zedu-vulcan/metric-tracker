"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { InboxIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "./useNotifications";

/** The top-bar inbox: opens the Inbox tab on your profile, with the unread count on the icon. */
export function InboxMenu() {
  const { href } = useProject();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { unreadCount } = useNotifications();
  const target = href("/profile?tab=inbox");
  const here = pathname === href("/profile") && searchParams.get("tab") === "inbox";

  return (
    <Link
      href={target}
      aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : "Inbox"}
      aria-current={here ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        "relative aria-[current=page]:border-primary aria-[current=page]:bg-accent aria-[current=page]:text-primary-deep"
      )}
    >
      <InboxIcon aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground tabular-nums ring-2 ring-background"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
