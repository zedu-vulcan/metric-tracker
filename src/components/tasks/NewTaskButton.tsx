"use client";

import { useProject } from "@/components/projects/ProjectProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./TaskFormDialog";
import { useTasks } from "./TasksProvider";

/** Top-bar shortcut: post a task from any page, then land on it. */
export function NewTaskButton() {
  const { href } = useProject();
  const { createTask } = useTasks();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        New task
      </Button>
      <Button size="icon" onClick={() => setOpen(true)} aria-label="New task" className="sm:hidden">
        <ListPlusIcon aria-hidden="true" />
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={async (input) => router.push(href(`/tasks/${(await createTask(input)).id}`))}
      />
    </>
  );
}
