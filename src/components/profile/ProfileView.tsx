"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BotIcon, InboxIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab, type ProfileDetails } from "./GeneralTab";
import { InboxTab } from "./InboxTab";
import { useNotifications } from "./useNotifications";

const TABS = ["general", "agents", "inbox"] as const;
type TabId = (typeof TABS)[number];

function ComingSoon({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card>
      <CardContent>
        <Empty className="border-0 py-10">
          <EmptyHeader>
            <EmptyMedia className="size-12 rounded-full bg-accent text-primary-deep [&_svg]:size-5">
              <Icon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-[15px] font-bold">{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

export function ProfileView({ profile }: { profile: ProfileDetails }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { unreadCount } = useNotifications();

  const requested = searchParams.get("tab");
  const tab: TabId = TABS.find((id) => id === requested) ?? "general";

  return (
    <Tabs value={tab} onValueChange={(next) => router.replace(`${pathname}?tab=${next}`, { scroll: false })} className="gap-4">
      <TabsList className="h-11 max-w-full self-start overflow-x-auto p-1">
        <TabsTrigger value="general" className="px-4">
          <UserRoundIcon aria-hidden="true" />
          General
        </TabsTrigger>
        <TabsTrigger value="agents" className="px-4">
          <BotIcon aria-hidden="true" />
          Agents
        </TabsTrigger>
        <TabsTrigger value="inbox" className="px-4">
          <InboxIcon aria-hidden="true" />
          Inbox
          {unreadCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralTab profile={profile} />
      </TabsContent>
      <TabsContent value="agents">
        <ComingSoon
          icon={BotIcon}
          title="Agents are coming soon"
          description="You'll manage your agents, their keys and the points they earn here."
        />
      </TabsContent>
      <TabsContent value="inbox">
        <InboxTab />
      </TabsContent>
    </Tabs>
  );
}
