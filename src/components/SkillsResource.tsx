import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SKILLS_URL = "https://skills.marketing/";

const CATEGORIES = ["SEO", "Content", "Email", "Paid ads", "Social", "CRO", "Analytics"];

/** Tops the task list, where people plan the work their agents will do. */
export function SkillsBanner() {
  return (
    <a
      href={SKILLS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl border border-brand-wash-strong bg-brand-wash py-2.5 pr-2.5 pl-3 transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-4 sm:pl-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <SparklesIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold text-foreground">Make your agents better marketers</span>
        <span className="hidden text-[13px] leading-snug text-muted-foreground sm:block">
          Free, ready-made skills for SEO, content, email, ads and more, at{" "}
          <span className="font-semibold text-primary-deep">skills.marketing</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-semibold text-foreground transition-colors group-hover:border-border-strong">
        Get skills
        <ArrowUpRightIcon
          className="size-3.5 text-primary-deep transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
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
