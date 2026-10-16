"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export function AddListModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => nameRef.current?.focus(), 50);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function openModal() {
    setName("");
    setError("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter a list name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not create the list. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const modal = open && (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-[rgba(30,29,34,0.38)] animate-overlay-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <section
        className="w-[min(100%,400px)] p-6 border border-line rounded-[12px] bg-sheet animate-sheet-in max-[480px]:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 mb-[6px]">
          <h2
            id="list-modal-title"
            className="m-0 text-ink [font-family:Georgia,serif] text-[25px] font-medium tracking-[-0.04em]"
          >
            New list
          </h2>
          <button
            type="button"
            className="w-9 min-h-[36px] p-0 border border-line rounded-[8px] bg-transparent text-muted text-[23px] cursor-pointer hover:bg-surface hover:text-ink"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>

        <p className="mt-0 mb-6 text-muted text-[13px] leading-[1.6]">
          A list is a named vault that groups related directories together.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-[7px] mb-[18px]">
            <label htmlFor="list-name" className="text-ink text-[12px] font-semibold">Name</label>
            <input
              ref={nameRef}
              id="list-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch directories"
              maxLength={100}
              required
              className="w-full min-h-[44px] px-3 py-[10px] border border-line-strong rounded-[8px] bg-sheet text-ink text-[13px] focus:outline-[2px] focus:outline-[rgba(142,106,250,0.25)] focus:border-violet"
            />
          </div>

          {error && (
            <p className="m-0 mb-4 text-rejected text-[12px]" role="alert">{error}</p>
          )}

          <footer className="flex justify-end gap-[10px] pt-[18px] border-t border-line max-[480px]:flex-wrap">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-[6px] px-[13px] min-h-[44px] rounded-[8px] bg-transparent text-muted border border-line text-[13px] font-medium cursor-pointer w-auto whitespace-nowrap transition-[color,background-color,border-color] duration-[120ms] hover:text-ink hover:bg-sheet hover:border-line-strong"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-[6px] px-[15px] min-h-[44px] rounded-[8px] bg-violet text-white border-none text-[13px] font-semibold cursor-pointer w-auto whitespace-nowrap shadow-[0_1px_2px_rgba(118,81,232,0.25),0_4px_12px_rgba(118,81,232,0.14)] transition-[background-color,transform,box-shadow] duration-[140mg] hover:bg-violet-deep hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "Creating…" : "Create list"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );

  return (
    <>
      <button
        className="inline-flex items-center gap-[6px] px-[15px] h-[34px] rounded-[8px] bg-violet text-white border-none text-[13px] font-semibold cursor-pointer w-auto whitespace-nowrap shadow-[0_1px_2px_rgba(118,81,232,0.25),0_4px_12px_rgba(118,81,232,0.14)] transition-[background-color,transform,box-shadow] duration-[140ms] hover:bg-violet-deep hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(118,81,232,0.28),0_6px_18px_rgba(118,81,232,0.18)] active:translate-y-0"
        type="button"
        onClick={openModal}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        New list
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
