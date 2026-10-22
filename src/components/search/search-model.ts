import type { SearchResult, SearchResultType } from "@/lib/schemas/search";

export const searchGroupOrder: SearchResultType[] = [
  "goal",
  "workstream",
  "task",
  "agent",
  "directory",
  "content",
  "press_outlet",
  "press_coverage",
  "press_submission",
];

export const searchGroupLabels: Record<SearchResultType, string> = {
  goal: "Goals",
  workstream: "Workstreams",
  task: "Tasks",
  agent: "Agents",
  directory: "Directories",
  content: "Content",
  press_outlet: "Press outlets",
  press_coverage: "Press coverage",
  press_submission: "Press submissions",
};

export type SearchResultGroup = {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
};

export function groupResults(results: SearchResult[]): SearchResultGroup[] {
  return searchGroupOrder.flatMap((type) => {
    const group = results.filter((result) => result.type === type);
    return group.length > 0 ? [{ type, label: searchGroupLabels[type], results: group }] : [];
  });
}

export type HighlightPart = { text: string; match: boolean };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitHighlight(text: string, query: string): HighlightPart[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text, match: false }];

  const matcher = new RegExp(escapeRegExp(trimmedQuery), "gi");
  const parts: HighlightPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(matcher)) {
    const index = match.index;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: match[0], match: true });
    cursor = index + match[0].length;
  }

  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts;
}

export function matchesQuickAction(label: string, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalizedQuery.length === 0 || label.toLocaleLowerCase().includes(normalizedQuery);
}
