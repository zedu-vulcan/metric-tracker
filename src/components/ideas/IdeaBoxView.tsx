"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliveredWork } from "@/components/tasks/DeliveredWork";
import { shortDateTime } from "@/components/tasks/task-model";
import type { Attachment } from "@/components/tasks/thread-model";

const CATEGORIES = ["All", "SEO", "Content", "Lead hunting", "Press", "Research", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

type Deliverable = {
  id: string;
  title: string;
  taskType: string | null;
  doneBy: string;
  deliveredAt: string;
  attachment: Attachment;
};

function categoryForType(taskType: string | null): Exclude<Category, "All"> {
  switch (taskType?.toLowerCase().replace(/[\s-]+/g, "_")) {
    case "seo":
      return "SEO";
    case "content":
      return "Content";
    case "lead_hunting":
      return "Lead hunting";
    case "press":
      return "Press";
    case "research":
      return "Research";
    default:
      return "Other";
  }
}

export function IdeaBoxView({ deliverables }: { deliverables: Deliverable[] }) {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const counts = new Map<Category, number>(CATEGORIES.map((category) => [category, 0]));

  for (const deliverable of deliverables) {
    const category = categoryForType(deliverable.taskType);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  counts.set("All", deliverables.length);

  const filtered = activeCategory === "All"
    ? deliverables
    : deliverables.filter((deliverable) => categoryForType(deliverable.taskType) === activeCategory);

  return (
    <>
      <Tabs
        value={activeCategory}
        onValueChange={(value) => {
          const category = CATEGORIES.find((candidate) => candidate === value);
          if (category) setActiveCategory(category);
        }}
      >
        <TabsList aria-label="Filter approved work by category" className="h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
          {CATEGORIES.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="group/tab h-9 flex-none gap-2 border border-border bg-card px-4 text-sm text-foreground/75 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground"
            >
              {category}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground group-data-active/tab:bg-white/20 group-data-active/tab:text-primary-foreground">
                {counts.get(category) ?? 0}
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
