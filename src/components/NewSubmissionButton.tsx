"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Directory { id: string; name: string; list: { id: string; name: string } }

interface NewSubmissionButtonProps {
  directories: Directory[];
}

const STATUSES = [
  { value: "planned",   label: "Planned" },
  { value: "submitted", label: "Submitted" },
  { value: "live",      label: "Live" },
  { value: "rejected",  label: "Rejected" },
];

export function NewSubmissionButton({ directories }: NewSubmissionButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [directoryId, setDirectoryId] = useState("");
  const [status, setStatus] = useState("planned");
  const [submittedAt, setSubmittedAt] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  function openModal() {
    setDirectoryId(directories[0]?.id ?? "");
    setStatus("planned");
    setSubmittedAt("");
    setListingUrl("");
    setFieldErrors({});
    setServerError(null);
    setOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
  }

  useEffect(() => {
    if (open) setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading]);

  function handleStatusChange(val: string) {
    setStatus(val);
    if (val === "submitted" && !submittedAt) {
      setSubmittedAt(new Date().toISOString().split("T")[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = { directoryId, status };
      if (submittedAt) body.submittedAt = new Date(submittedAt).toISOString();
      if (listingUrl)  body.listingUrl  = listingUrl;

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) { setFieldErrors(data.details); }
        else { setServerError(data.error ?? "Something went wrong"); }
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const noDirectories = directories.length === 0;

  const inputBase = "w-full h-[42px] px-[14px] bg-surface border border-line rounded-[8px] text-ink text-[13px] transition-[border-color,box-shadow,background-color] duration-[120ms] focus:outline-none focus:bg-sheet focus:border-violet focus:shadow-[0_0_0_3px_rgba(142,106,250,0.2)] placeholder:text-muted placeholder:opacity-70";
  const inputError = "border-rejected focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]";

  // Group directories by list for optgroup
  const byList = directories.reduce<Record<string, { listName: string; dirs: Directory[] }>>(
    (acc, d) => {
      if (!acc[d.list.id]) acc[d.list.id] = { listName: d.list.name, dirs: [] };
      acc[d.list.id].dirs.push(d);
      return acc;
    },
    {},
  );
  const listGroups = Object.values(byList);

  const modal = open && (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(26,25,23,0.45)] backdrop-blur-[4px] animate-modal-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-sub-title"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        className="relative w-full max-w-[520px] max-h-[calc(100vh-32px)] overflow-y-auto p-6 bg-sheet border border-line rounded-[12px] shadow-[0_12px_32px_rgba(26,25,23,0.12),0_2px_6px_rgba(26,25,23,0.04)] animate-modal-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 id="new-sub-title" className="m-0 text-[16px] font-bold tracking-[-0.03em] text-ink leading-[1.2]">
            New submission
          </h2>
          <button
            type="button"
            className="bg-transparent border-none text-muted text-[12px] font-bold tracking-[0.06em] uppercase cursor-pointer px-2 py-1 rounded-[6px] w-auto transition-[color,background-color] duration-[120ms] hover:text-violet-deep hover:bg-violet-tint"
            onClick={closeModal}
            disabled={loading}
            aria-label="Close"
          >
            CANCEL
          </button>
        </div>

        <p className="m-0 mb-5 text-muted text-[13px] leading-[1.5]">
          Track a directory submission and monitor its status over time.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

          {noDirectories && (
            <p className="m-0 px-3 py-[10px] rounded-[8px] bg-rejected-bg text-rejected text-[13px]">
              Add at least one directory before creating a submission.
            </p>
          )}

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="sub-directory" className="text-[12px] font-semibold text-ink tracking-[-0.01em]">Directory</label>
            <select
              ref={firstFieldRef}
              id="sub-directory"
              className={`${inputBase} modal-select ${fieldErrors.directoryId ? inputError : ""}`}
              value={directoryId}
              onChange={(e) => setDirectoryId(e.target.value)}
              required
              disabled={noDirectories}
            >
              {noDirectories ? (
                <option>No directories yet</option>
              ) : listGroups.length === 1 ? (
                directories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)
              ) : (
                listGroups.map((g) => (
                  <optgroup key={g.listName} label={g.listName}>
                    {g.dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                ))
              )}
            </select>
            {fieldErrors.directoryId && <span className="text-[12px] text-rejected mt-[2px]">{fieldErrors.directoryId[0]}</span>}
          </div>

          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="sub-status" className="text-[12px] font-semibold text-ink tracking-[-0.01em]">Status</label>
              <select
                id="sub-status"
                className={`${inputBase} modal-select`}
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-[6px]">
              <label htmlFor="sub-date" className="text-[12px] font-semibold text-ink tracking-[-0.01em]">
                Submitted date
                <span className="ml-[6px] text-[11px] font-normal text-muted tracking-[0.02em] uppercase">optional</span>
              </label>
              <input
                id="sub-date"
                type="date"
                className={inputBase}
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label htmlFor="sub-listing" className="text-[12px] font-semibold text-ink tracking-[-0.01em]">
              Listing URL
              <span className="ml-[6px] text-[11px] font-normal text-muted tracking-[0.02em] uppercase">optional</span>
            </label>
            <input
              id="sub-listing"
              type="url"
              className={`${inputBase} ${fieldErrors.listingUrl ? inputError : ""}`}
              placeholder="https://www.producthunt.com/posts/..."
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
            />
            {fieldErrors.listingUrl && <span className="text-[12px] text-rejected mt-[2px]">{fieldErrors.listingUrl[0]}</span>}
          </div>

          {serverError && (
            <p className="m-0 px-3 py-[10px] rounded-[8px] bg-rejected-bg text-rejected text-[13px]">
              {serverError}
            </p>
          )}

          <div className="flex items-center gap-[10px] mt-[6px]">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-[18px] h-[38px] rounded-[8px] bg-violet text-white border-none text-[13px] font-semibold cursor-pointer w-auto whitespace-nowrap shadow-[0_1px_2px_rgba(118,81,232,0.25),0_4px_12px_rgba(118,81,232,0.14)] transition-[background-color,transform,box-shadow] duration-[140ms] hover:bg-violet-deep hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(118,81,232,0.28),0_6px_18px_rgba(118,81,232,0.18)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading || noDirectories}
            >
              {loading ? "Saving…" : "Save submission"}
            </button>
          </div>
        </form>
      </div>
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
        New submission
      </button>

      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
