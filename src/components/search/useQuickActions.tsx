"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type QuickAction = {
  id: "new-goal" | "create-agent";
  label: string;
  icon: LucideIcon;
  run: () => void;
};

export function useQuickActions(): { actions: QuickAction[]; dialogs: ReactNode } {
  return { actions: [], dialogs: null };
}
