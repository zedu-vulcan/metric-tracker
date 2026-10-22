"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BotIcon, TargetIcon, type LucideIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { useGoals } from "@/components/goals/GoalsProvider";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";

export type QuickAction = {
  id: "new-goal" | "create-agent";
  label: string;
  icon: LucideIcon;
  run: () => void;
};

export function useQuickActions(): {
  actions: QuickAction[];
  dialogs: React.ReactNode;
} {
  const { href } = useProject();
  const { createGoal } = useGoals();
  const router = useRouter();

  const [goalOpen, setGoalOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const actions: QuickAction[] = [
    {
      id: "new-goal",
      label: "New goal",
      icon: TargetIcon,
      run: () => setGoalOpen(true),
    },
    {
      id: "create-agent",
      label: "Create agent",
      icon: BotIcon,
      run: () => setAgentOpen(true),
    },
  ];

  const dialogs = (
    <>
      <GoalFormDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        onCreate={async (input) => {
          const created = await createGoal(input);
          router.push(href(`/goals/${created.id}`));
        }}
      />
      <CreateAgentDialog open={agentOpen} onOpenChange={setAgentOpen} />
    </>
  );

  return { actions, dialogs };
}
