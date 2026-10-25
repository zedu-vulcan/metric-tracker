"use client";

import { useState } from "react";
import { AttachmentFile } from "@/components/tasks/AttachmentFile";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Attachment } from "@/components/tasks/thread-model";

export type IdeaBoxCategory = "SEO" | "Content" | "Lead hunting" | "Press" | "Research" | "Other";
type CategoryFilter = "All" | IdeaBoxCategory;

export type IdeaBoxDeliverable = {
  id: string;
  title: string;
  category: IdeaBoxCategory;
  agentName: string;
  attachment: Attachment;
};

const CATEGORIES: CategoryFilter[] = ["All", "SEO", "Content", "Lead hunting", "Press", "Research", "Other"];

function isCategoryFilter(value: string): value is CategoryFilter {
  return CATEGORIES.some((category) => category === value);
}

export function IdeaBoxView({ deliverables }: { deliverables: IdeaBoxDeliverable[] }) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");
  const counts = new Map<CategoryFilter, number>([["All", deliverables.length]]);
  for (const category of CATEGORIES.slice(1)) counts.set(category, 0);
  for (const deliverable of deliverables) {
    counts.set(deliverable.category, (counts.get(deliverable.category) ?? 0) + 1);
  }

  const visibleDeliverables =
    activeCategory === "All"
      ? deliverables
      : deliverables.filter((deliverable) => deliverable.category === activeCategory);

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={activeCategory}
        onValueChange={(value) => {
          if (isCategoryFilter(value)) setActiveCategory(value);
        }}
      >
        <TabsList
          className="h-auto max-w-full flex-wrap justify-start gap-1.5 rounded-none bg-transparent p-0"
          aria-label="Filter approved deliverables by category"
        >
          {CATEGORIES.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="h-10 flex-none gap-2 border border-border bg-card px-3.5 data-[active]:border-primary data-[active]:text-primary-deep"
            >
              {category}
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums">
                {counts.get(category) ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visibleDeliverables.length === 0 ? (
        <section className="rounded-[22px] border border-border bg-card p-5 sm:p-6">
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyTitle>No approved deliverables{activeCategory === "All" ? " yet" : ` in ${activeCategory}`}</EmptyTitle>
              <EmptyDescription>
                Approved marketing work will appear here, separate from task conversations.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      ) : (
        <div className="grid gap-4">
          {visibleDeliverables.map((deliverable) => (
            <article
              key={deliverable.id}
              className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex flex-col gap-2">
                <h2 className="m-0 text-base leading-snug font-bold text-foreground">{deliverable.title}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{deliverable.category}</Badge>
                  <span className="text-sm text-muted-foreground">Done by {deliverable.agentName}</span>
                </div>
              </div>
              <AttachmentFile attachment={deliverable.attachment} from={`Done by ${deliverable.agentName}`} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
