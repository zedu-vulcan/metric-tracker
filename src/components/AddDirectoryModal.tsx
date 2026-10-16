"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface AddDirectoryModalProps {
  listId: string;
  listName: string;
}

export function AddDirectoryModal({ listId, listName }: AddDirectoryModalProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
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
    setUrl("");
    setError("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanUrl = url.trim();

    if (!cleanName) {
      setError("Enter a directory name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/directories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, url: cleanUrl || undefined, listId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save the directory. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save the directory. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full min-h-[44px] px-3 py-[10px] border border-line-strong rounded-[8px] bg-sheet text-ink text-[13px] focus:outline-[2px] focus:outline-[rgba(142,106,250,0.25)] focus:border-violet";

  const modal = open && (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-[rgba(30,29,34,0.38)] animate-overlay-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <section
        className="w-[min(100%,440px)] max-h-[calc(100vh-40px)] overflow-y-auto p-6 border border-line rounded-[12px] bg-sheet animate-sheet-in max-[480px]:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dir-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 mb-[6px]">
          <h2
            id="dir-modal-title"
            className="m-0 text-ink [font-family:Georgia,serif] text-[25px] font-medium tracking-[-0.04em]"
          >
            Add a directory
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
          Adding to <strong className="text-ink font-semibold">{listName}</strong>
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-[7px] mb-[18px]">
            <label htmlFor="dir-name" className="text-ink text-[12px] font-semibold">Name</label>
            <input
              ref={nameRef}
              id="dir-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Hunt"
              maxLength={100}
              required
              className={inputClass}
            />
          </div>

          <div className="grid gap-[7px] mb-[18px]">
            <label htmlFor="dir-url" className="text-ink text-[12px] font-semibold">
              URL
              <span className="ml-[6px] text-[11px] font-normal text-muted tracking-[0.02em] uppercase">optional</span>
            </label>
            <input
              id="dir-url"
              name="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.producthunt.com"
              maxLength={2048}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="m-0 text-rejected text-[12px]" role="alert">{error}</p>
          )}

          <footer className="flex justify-end gap-[10px] mt-6 pt-[18px] border-t border-line max-[480px]:flex-wrap">
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
              className="inline-flex items-center justify-center gap-[6px] px-[15px] min-h-[44px] rounded-[8px] bg-violet text-white border-none text-[13px] font-semibold cursor-pointer w-auto whitespace-nowrap shadow-[0_1px_2px_rgba(118,81,232,0.25),0_4px_12px_rgba(118,81,232,0.14)] transition-[background-color,transform,box-shadow] duration-[140ms] hover:bg-violet-deep hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save directory"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );

  return (
    <>
      <button
        className="inline-flex items-center gap-[6px] px-[11px] h-[30px] rounded-[7px] bg-transparent text-muted border border-line text-[12px] font-medium cursor-pointer w-auto whitespace-nowrap transition-[color,background-color,border-color] duration-[120ms] hover:text-ink hover:bg-sheet hover:border-line-strong"
        type="button"
        onClick={openModal}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        Add directory
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
