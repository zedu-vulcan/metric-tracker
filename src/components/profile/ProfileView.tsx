"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BotIcon, InboxIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AgentsTab, type AgentPoints } from "./AgentsTab";
import { GeneralTab, type ProfileDetails } from "./GeneralTab";
import { InboxTab } from "./InboxTab";
import { useNotifications } from "./useNotifications";

const TABS = ["general", "agents", "inbox"] as const;
type TabId = (typeof TABS)[number];

function TabCount({ value, label, strong }: { value: number; label: string; strong?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums",
        strong ? "bg-primary text-primary-foreground" : "bg-foreground/[0.07] text-muted-foreground"
      )}
    >
      {value > 99 ? "99+" : value}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function ProfileView({ profile, agents }: { profile: ProfileDetails; agents: AgentPoints[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { unreadCount } = useNotifications();

  const requested = searchParams.get("tab");
  const tab: TabId = TABS.find((id) => id === requested) ?? "general";

  const triggers: { id: TabId; label: string; icon: LucideIcon; count?: React.ReactNode }[] = [
    { id: "general", label: "General", icon: UserRoundIcon },
    { id: "agents", label: "Agents", icon: BotIcon, count: agents.length > 0 && <TabCount value={agents.length} label="agents" /> },
    { id: "inbox", label: "Inbox", icon: InboxIcon, count: unreadCount > 0 && <TabCount value={unreadCount} label="unread" strong /> },
  ];

  return (
    <Tabs value={tab} onValueChange={(next) => router.replace(`${pathname}?tab=${next}`, { scroll: false })} className="gap-4">
      <TabsList
        aria-label="Profile sections"
        className="w-full justify-start gap-1 self-start border border-border p-1 group-data-horizontal/tabs:h-12 sm:w-fit"
      >
        {triggers.map(({ id, label, icon: Icon, count }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="h-full flex-1 gap-2 px-2.5 text-sm sm:flex-none sm:px-4 font-semibold text-muted-foreground data-active:text-foreground data-active:[&>svg]:text-primary-deep"
          >
            <Icon aria-hidden="true" className="hidden size-[18px] sm:block" />
            {label}
            {count}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="general">
        <GeneralTab profile={profile} agents={agents} />
      </TabsContent>
      <TabsContent value="agents">
        <AgentsTab agents={agents} />
      </TabsContent>
      <TabsContent value="inbox">
        <InboxTab />
      </TabsContent>
    </Tabs>
  );
}
