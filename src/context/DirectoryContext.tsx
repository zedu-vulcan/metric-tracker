"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ChecklistItem, DirectoryActivity, DirectoryInput, DirectoryItem } from "@/types/directory";
import { apiFetch } from "@/lib/request-json";

interface DirectoryContextType {
  directories: DirectoryItem[];
  activities: DirectoryActivity[];
  isLoading: boolean;
  loadError: string;
  actionError: string;
  clearActionError: () => void;
  reload: () => Promise<void>;
  selectedDirectoryId: string | null;
  setSelectedDirectoryId: (id: string) => void;
  addDirectory: (input: DirectoryInput) => Promise<DirectoryItem>;
  updateDirectory: (id: string, input: Partial<DirectoryInput>) => Promise<DirectoryItem>;
  deleteDirectory: (id: string) => Promise<void>;
  toggleChecklistItem: (directoryId: string, itemId: string, done: boolean) => Promise<void>;
  addChecklistItem: (directoryId: string, label: string) => Promise<void>;
  removeChecklistItem: (directoryId: string, itemId: string) => Promise<void>;
  reportError: (error: unknown) => void;
}

const DirectoryContext = createContext<DirectoryContextType | undefined>(undefined);

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: Record<string, string[]> })
    | null;
  if (!response.ok) {
    const detail = body?.details ? Object.values(body.details).flat()[0] : undefined;
    throw new Error(detail ?? body?.error ?? "Something went wrong. Please try again.");
  }
  return body as T;
}

export function DirectoryProvider({ children }: { children: React.ReactNode }) {
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [activities, setActivities] = useState<DirectoryActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      setActivities(await request<DirectoryActivity[]>("/api/directories/activity?limit=50"));
    } catch {
      // The feed is secondary; the directories themselves still load.
    }
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [list] = await Promise.all([request<DirectoryItem[]>("/api/directories"), loadActivity()]);
      setDirectories(list);
      setSelectedDirectoryId((current) =>
        current && list.some((directory) => directory.id === current) ? current : (list[0]?.id ?? null)
      );
    } catch {
      setLoadError("Couldn't load directories. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [loadActivity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reportError = useCallback((error: unknown) => {
    setActionError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  }, []);

  const replace = (updated: DirectoryItem) =>
    setDirectories((previous) => previous.map((directory) => (directory.id === updated.id ? updated : directory)));

  const patchChecklist = (directoryId: string, change: (items: ChecklistItem[]) => ChecklistItem[]) =>
    setDirectories((previous) =>
      previous.map((directory) =>
        directory.id === directoryId ? { ...directory, checklist: change(directory.checklist) } : directory
      )
    );

  const addDirectory = async (input: DirectoryInput) => {
    const created = await request<DirectoryItem>("/api/directories", { method: "POST", body: JSON.stringify(input) });
    setDirectories((previous) => [created, ...previous]);
    setSelectedDirectoryId(created.id);
    void loadActivity();
    return created;
  };

  const updateDirectory = async (id: string, input: Partial<DirectoryInput>) => {
    const updated = await request<DirectoryItem>(`/api/directories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    replace(updated);
    void loadActivity();
    return updated;
  };

  const deleteDirectory = async (id: string) => {
    await request<void>(`/api/directories/${id}`, { method: "DELETE" });
    setDirectories((previous) => previous.filter((directory) => directory.id !== id));
    setSelectedDirectoryId((current) => (current === id ? null : current));
    void loadActivity();
  };

  const toggleChecklistItem = async (directoryId: string, itemId: string, done: boolean) => {
    // Tick immediately; roll back if the save fails.
    patchChecklist(directoryId, (items) => items.map((item) => (item.id === itemId ? { ...item, done } : item)));
    try {
      await request<ChecklistItem>(`/api/directories/${directoryId}/checklist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      });
      if (done) void loadActivity();
    } catch (error) {
      patchChecklist(directoryId, (items) => items.map((item) => (item.id === itemId ? { ...item, done: !done } : item)));
      throw error;
    }
  };

  const addChecklistItem = async (directoryId: string, label: string) => {
    const item = await request<ChecklistItem>(`/api/directories/${directoryId}/checklist`, {
      method: "POST",
      body: JSON.stringify({ label }),
    });
    patchChecklist(directoryId, (items) => [...items, item]);
  };

  const removeChecklistItem = async (directoryId: string, itemId: string) => {
    await request<void>(`/api/directories/${directoryId}/checklist/${itemId}`, { method: "DELETE" });
    patchChecklist(directoryId, (items) => items.filter((item) => item.id !== itemId));
  };

  return (
    <DirectoryContext.Provider
      value={{
        directories,
        activities,
        isLoading,
        loadError,
        actionError,
        clearActionError: () => setActionError(""),
        reload,
        selectedDirectoryId,
        setSelectedDirectoryId,
        addDirectory,
        updateDirectory,
        deleteDirectory,
        toggleChecklistItem,
        addChecklistItem,
        removeChecklistItem,
        reportError,
      }}
    >
      {children}
    </DirectoryContext.Provider>
  );
}

export function useDirectories() {
  const context = useContext(DirectoryContext);
  if (!context) {
    throw new Error("useDirectories must be used within a DirectoryProvider");
  }
  return context;
}
