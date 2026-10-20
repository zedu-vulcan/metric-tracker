"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AgentAvatar, MyAgent } from "./agent-model";

const SELECTED_KEY = "zedu-amp:selected-agent";

export type NewAgent = { name: string; speciality: string; description: string; avatar: AgentAvatar };
/** An agent together with its plain key, which the server returns only once. */
export type AgentWithKey = { agent: MyAgent; key: string };

type AgentsContextValue = {
  agents: MyAgent[];
  loading: boolean;
  selected?: MyAgent;
  select: (agentId: string) => void;
  createAgent: (input: NewAgent) => Promise<AgentWithKey>;
  regenerateKey: (agentId: string) => Promise<AgentWithKey>;
};

const AgentsContext = createContext<AgentsContextValue | undefined>(undefined);

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message && message !== "Validation failed" ? message : "Something went wrong. Try again.");
  }
  return body as T;
}

function splitKey({ key, ...agent }: MyAgent & { key: string }): AgentWithKey {
  return { agent, key };
}

/** The signed-in user's agents, loaded from /api/agents and refreshed when the tab regains focus. */
export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<MyAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SELECTED_KEY);
      if (saved) setSelectedId(saved);
    } catch {
      // Storage can be unavailable; the first agent stays selected.
    }
  }, []);

  // Refetching on focus picks up an agent switching from "waiting" to "connected" after its setup prompt is pasted.
  useEffect(() => {
    let active = true;
    const load = () =>
      requestJson<MyAgent[]>("/api/agents")
        .then((next) => active && setAgents(next))
        .catch(() => undefined)
        .finally(() => active && setLoading(false));

    void load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  const select = useCallback((agentId: string) => {
    setSelectedId(agentId);
    try {
      window.localStorage.setItem(SELECTED_KEY, agentId);
    } catch {
      // Not critical if the choice can't be remembered.
    }
  }, []);

  const createAgent = useCallback(
    async (input: NewAgent) => {
      const created = splitKey(
        await requestJson<MyAgent & { key: string }>("/api/agents", { method: "POST", body: JSON.stringify(input) })
      );
      setAgents((previous) => [...previous, created.agent]);
      select(created.agent.id);
      return created;
    },
    [select]
  );

  const regenerateKey = useCallback(async (agentId: string) => {
    const renewed = splitKey(
      await requestJson<MyAgent & { key: string }>(`/api/agents/${agentId}/key`, { method: "POST" })
    );
    setAgents((previous) => previous.map((agent) => (agent.id === agentId ? renewed.agent : agent)));
    return renewed;
  }, []);

  const value = useMemo<AgentsContextValue>(
    () => ({
      agents,
      loading,
      selected: agents.find((agent) => agent.id === selectedId) ?? agents[0],
      select,
      createAgent,
      regenerateKey,
    }),
    [agents, loading, selectedId, select, createAgent, regenerateKey]
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) throw new Error("useAgents must be used inside AgentsProvider");
  return context;
}
