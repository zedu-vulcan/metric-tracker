"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliveredWork } from "@/components/tasks/DeliveredWork";
import { shortDateTime, taskTypeLabel } from "@/components/tasks/task-model";
import type { Attachment } from "@/components/tasks/thread-model";

const ALL_CATEGORY = "all";
const UNCATEGORIZED = "Uncategorized";

type Deliverable = {
  id: string;
  title: string;
  taskType: string | null;
  doneBy: string;
  deliveredAt: string;
  attachment: Attachment;
};

function categoryForType(taskType: string | null): string {
  const slug = taskType?.trim();
  return slug ? taskTypeLabel(slug) : UNCATEGORIZED;
}

export function IdeaBoxView({ deliverables }: { deliverables: Deliverable[] }) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const categories = Array.from(
    new Map(
      deliverables.map((deliverable) => {
        const label = categoryForType(deliverable.taskType);
        return [`type:${label.toLowerCase()}`, label] as const;
      })
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const selectedCategory = categories.some(({ value }) => value === activeCategory) || activeCategory === ALL_CATEGORY
    ? activeCategory
    : ALL_CATEGORY;
  const categoryOptions = [{ value: ALL_CATEGORY, label: "All" }, ...categories];
  const counts = new Map(categoryOptions.map(({ value }) => [value, 0]));

  for (const deliverable of deliverables) {
    const value = `type:${categoryForType(deliverable.taskType).toLowerCase()}`;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  counts.set(ALL_CATEGORY, deliverables.length);

  const filtered = selectedCategory === ALL_CATEGORY
    ? deliverables
    : deliverables.filter((deliverable) => `type:${categoryForType(deliverable.taskType).toLowerCase()}` === selectedCategory);

  return (
    <>
      <Tabs
        value={selectedCategory}
        onValueChange={(value) => {
          const category = categoryOptions.find((candidate) => candidate.value === value);
          if (category) setActiveCategory(category.value);
        }}
      >
        <TabsList aria-label="Filter approved work by category" className="h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
          {categoryOptions.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="group/tab h-9 flex-none gap-2 border border-border bg-card px-4 text-sm text-foreground/75 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
            >
              {label}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground group-data-[state=active]/tab:bg-white/20 group-data-[state=active]/tab:text-primary-foreground">
                {counts.get(value) ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Empty className="min-h-48 rounded-[22px] border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>{deliverables.length === 0 ? "No approved deliverables yet" : "No deliverables in this category"}</EmptyTitle>
            <EmptyDescription>
              {deliverables.length === 0
                ? "Approved task deliveries will appear here."
                : "Choose another category to see more approved work."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4">
          {filtered.map((deliverable) => {
            const category = categoryForType(deliverable.taskType);
            return (
              <Card key={deliverable.id} className="gap-4">
                <CardHeader className="gap-3">
                  <CardTitle className="text-base">{deliverable.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Done by {deliverable.doneBy}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <DeliveredWork
                    attachment={deliverable.attachment}
                    from={`Done by ${deliverable.doneBy} · ${shortDateTime.format(new Date(deliverable.deliveredAt))}`}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
