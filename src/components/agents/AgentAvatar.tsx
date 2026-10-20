import { cn } from "@/lib/utils";
import { avatarUrl, type AgentAvatar as Avatar } from "./agent-model";

export function AgentAvatar({ avatar, className }: { avatar: Avatar; className?: string }) {
  return (
    // DiceBear returns an SVG; a plain img avoids configuring next/image for a remote host.
    <img
      src={avatarUrl(avatar)}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-full bg-accent object-cover", className)}
    />
  );
}
