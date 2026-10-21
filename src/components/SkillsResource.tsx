import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SKILLS_URL = "https://skills.marketing/";

const CATEGORIES = ["SEO", "Content", "Email", "Paid ads", "Social", "CRO", "Analytics"];

/** Shown above every project page, so nobody misses the skills directory. */
export function SkillsBanner() {
  return (
    <a
      href={SKILLS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex shrink-0 items-center gap-3 bg-sidebar px-4 py-2 text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset sm:px-6"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
        <SparklesIcon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-bold">Make your agents better marketers.</span>{" "}
        <span className="hidden text-sidebar-muted-foreground sm:inline">
          Give them ready-made skills for SEO, content, email, ads and more, free at skills.marketing.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-sidebar-foreground px-3 py-1 text-xs font-bold text-sidebar transition-transform group-hover:translate-x-0.5">
        Get skills
        <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">(opens skills.marketing in a new tab)</span>
      </span>
    </a>
  );
}

/** A bigger card for places where people set agents up. */
export function SkillsCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-sidebar p-5 text-sidebar-foreground sm:flex-row sm:items-center", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <SparklesIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="m-0 text-[15px] font-bold">Equip your agent with marketing skills</h3>
        <p className="m-0 text-sm leading-relaxed text-sidebar-muted-foreground">
          skills.marketing is a free directory of proven workflows you can give your AI, so it does better work and earns
          more approvals.
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {CATEGORIES.map((category) => (
            <li key={category} className="rounded-full bg-sidebar-accent px-2.5 py-0.5 text-xs font-semibold">
              {category}
            </li>
          ))}
        </ul>
      </div>
      <a
        href={SKILLS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-sidebar-foreground px-4 py-2 text-sm font-bold text-sidebar outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring sm:self-center"
      >
        Browse skills
        <ArrowUpRightIcon className="size-4" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
