"use client";

import { useState } from "react";
import { ShuffleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AVATAR_STYLES, randomSeeds, type AgentAvatar as Avatar } from "./agent-model";
import { AgentAvatar } from "./AgentAvatar";

const OPTIONS = 8;

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (avatar: Avatar) => void }) {
  const [seeds, setSeeds] = useState(() => [value.seed, ...randomSeeds(OPTIONS - 1)]);

  const shuffle = () => {
    const next = randomSeeds(OPTIONS);
    setSeeds(next);
    onChange({ ...value, seed: next[0] });
  };

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-2 text-[13px] font-semibold text-foreground">Avatar</legend>

      <div className="flex items-center gap-4">
        <AgentAvatar avatar={value} className="size-16 border border-border" />
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Avatar style" className="flex rounded-full bg-muted p-1">
            {AVATAR_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                role="radio"
                aria-checked={value.style === style.value}
                onClick={() => onChange({ ...value, style: style.value })}
                className={cn(
                  "rounded-full px-3 py-1 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  value.style === style.value
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={shuffle}>
            <ShuffleIcon data-icon="inline-start" aria-hidden="true" />
            Shuffle
          </Button>
        </div>
      </div>

      <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-8 gap-2">
        {seeds.map((seed, index) => {
          const checked = value.seed === seed;
          return (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`Avatar option ${index + 1}`}
              onClick={() => onChange({ ...value, seed })}
              className={cn(
                "aspect-square rounded-full p-0.5 transition-[box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                checked ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-border-strong"
              )}
            >
              <AgentAvatar avatar={{ style: value.style, seed }} className="size-full" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
