"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Copies text and reports which item was copied for a moment, so the button can say "Copied". */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied(null);
      return false;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
    return true;
  }, []);

  return { copied, copy };
}
