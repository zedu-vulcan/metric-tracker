import { cn } from "@/lib/utils";

// Recessive chart chrome, expressed with the design tokens.
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" } as const;
export const GRID_STROKE = "var(--border)";
export const CURSOR = { stroke: "var(--border-strong)", strokeWidth: 1 } as const;

export function TooltipCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-44 flex-col gap-1.5 rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md">
      <span className="font-semibold text-foreground">{title}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** Value first (strong), series name second; keyed with a short line of the series colour. */
export function TooltipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className={cn("h-0.5 w-2.5 shrink-0 rounded-full", swatch ?? "bg-transparent")} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

/** A legend entry that shows or hides its series. */
export function LegendToggle({
  label,
  swatch,
  pressed,
  disabled,
  onToggle,
  shape = "line",
}: {
  label: string;
  swatch: string;
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  shape?: "line" | "block";
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? "At least one series stays visible" : pressed ? `Hide ${label}` : `Show ${label}`}
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
        !pressed && "text-muted-foreground line-through decoration-muted-foreground/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-full",
          shape === "line" ? "h-0.5 w-3" : "size-2.5 rounded-[3px]",
          pressed ? swatch : "bg-border-strong",
        )}
      />
      {label}
    </button>
  );
}
