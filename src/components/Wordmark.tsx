import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <path
        d="M16 3c7.2 0 13 5.3 13 12.2 0 6.8-5.8 12.2-13 12.2-1.7 0-3.3-.3-4.8-.8L5.6 29a1 1 0 0 1-1.4-1.1l1.2-5.1A11.7 11.7 0 0 1 3 15.2C3 8.3 8.8 3 16 3Z"
        className="fill-primary"
      />
      <path d="M17.6 8.2 11 16.6h4.3l-1.1 7.2 6.8-8.9h-4.4l1-6.7Z" className="fill-primary-foreground" />
    </svg>
  );
}

export function Wordmark({
  href,
  tone = "default",
  className,
}: {
  href: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.03em] no-underline",
        tone === "inverse" ? "text-sidebar-foreground" : "text-foreground",
        className
      )}
      href={href}
    >
      <BrandMark />
      <span>Amp</span>
    </a>
  );
}
