import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onChange, disabled, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group inline-flex items-center gap-2.5 cursor-pointer select-none",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-input bg-background transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "group-hover:border-primary/60"
          )}
        >
          {checked && <CheckIcon className="size-3 stroke-[3]" />}
        </span>
        {label && <span className="text-sm font-medium leading-none text-foreground">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
