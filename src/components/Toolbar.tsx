"use client";

import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between", className)}
      {...props}
    />
  );
}

export function ToolbarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0",
        className
      )}
      {...props}
    />
  );
}

export function SearchPill({
  value,
  onChange,
  placeholder,
  className,
  inputProps,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  inputProps?: Pick<React.ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby" | "maxLength" | "onCompositionStart" | "onCompositionEnd">;
}) {
  return (
    <div className={cn("relative w-full md:w-72", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        {...inputProps}
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-border bg-card pr-10 pl-11 text-sm text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export type PillOption = { value: string; label: string };

export function PillSelect({
  label,
  value,
  onChange,
  options,
  defaultValue = "all",
  className,
  selectProps,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
  defaultValue?: string;
  className?: string;
  selectProps?: Pick<React.ComponentProps<"select">, "id" | "aria-invalid" | "aria-describedby" | "disabled">;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  const active = value !== defaultValue;

  return (
    <label
      className={cn(
        "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border pr-9 pl-4 text-sm whitespace-nowrap transition-[color,background-color,border-color,box-shadow] has-[select:focus-visible]:ring-3 has-[select:focus-visible]:ring-ring/50 has-[select:disabled]:cursor-not-allowed has-[select:disabled]:opacity-50 has-[select[aria-invalid=true]]:border-destructive",
        active
          ? "border-primary/35 bg-accent text-accent-foreground"
          : "border-border bg-card text-foreground hover:border-border-strong",
        className
      )}
    >
      <span className={active ? "text-accent-foreground/80" : "text-muted-foreground"}>{label}</span>
      <span className="font-semibold">{selected?.label}</span>
      <ChevronDownIcon
        className={cn(
          "pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2",
          active ? "text-accent-foreground" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
      <select
        {...selectProps}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
