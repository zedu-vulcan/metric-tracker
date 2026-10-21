"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, requestJson } from "@/lib/request-json";
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
  removeAgent: (agentId: string) => Promise<void>;
};

const AgentsContext = createContext<AgentsContextValue | undefined>(undefined);

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

  const removeAgent = useCallback(async (agentId: string) => {
    const response = await apiFetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("Couldn't delete the agent. Try again.");
    setAgents((previous) => previous.filter((agent) => agent.id !== agentId));
  }, []);

  const value = useMemo<AgentsContextValue>(
    () => ({
      agents,
      loading,
      selected: agents.find((agent) => agent.id === selectedId) ?? agents[0],
      select,
      createAgent,
      regenerateKey,
      removeAgent,
    }),
    [agents, loading, selectedId, select, createAgent, regenerateKey, removeAgent]
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) throw new Error("useAgents must be used inside AgentsProvider");
  return context;
}
