"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BotIcon, ListPlusIcon, type LucideIcon } from "lucide-react";
import { useProject } from "@/components/projects/ProjectProvider";
import { useTasks } from "@/components/tasks/TasksProvider";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";

export type QuickAction = {
  id: "new-task" | "create-agent";
  label: string;
  icon: LucideIcon;
  run: () => void;
};

export function useQuickActions(): {
  actions: QuickAction[];
  dialogs: React.ReactNode;
} {
  const { href } = useProject();
  const { createTask } = useTasks();
  const router = useRouter();

  const [taskOpen, setTaskOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const actions: QuickAction[] = [
    {
      id: "new-task",
      label: "New task",
      icon: ListPlusIcon,
      run: () => setTaskOpen(true),
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
      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onCreate={async (input) => {
          const created = await createTask(input);
          router.push(href(`/tasks/${created.id}`));
        }}
      />
      <CreateAgentDialog open={agentOpen} onOpenChange={setAgentOpen} />
    </>
  );

  return { actions, dialogs };
}
