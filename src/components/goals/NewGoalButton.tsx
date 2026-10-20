"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "./GoalFormDialog";
import { useGoals } from "./GoalsProvider";

/** Top-bar shortcut: create a goal from any page, then land on it. */
export function NewGoalButton() {
  const { createGoal } = useGoals();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        New goal
      </Button>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="New goal" className="sm:hidden">
        <TargetIcon aria-hidden="true" />
      </Button>
      <GoalFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={(input) => router.push(`/dashboard/goals/${createGoal(input).id}`)}
      />
    </>
  );
}
