import type {
  Searcher,
  SearchResponse,
  SearchResultType,
  SearchResult,
} from "@/lib/schemas/search";
import {
  searchGoals,
  searchWorkstreams,
  searchTasks,
  searchAgents,
} from "./work";
import {
  searchDirectories,
  searchContent,
  searchPressOutlets,
  searchPressCoverage,
  searchPressSubmissions,
} from "./marketing";

// Fixed order of groups as specified in the contract
export const groupOrder: SearchResultType[] = [
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

export const searcherRegistry: Record<SearchResultType, Searcher> = {
  goal: searchGoals,
  workstream: searchWorkstreams,
  task: searchTasks,
  agent: searchAgents,
  directory: searchDirectories,
  content: searchContent,
  press_outlet: searchPressOutlets,
  press_coverage: searchPressCoverage,
  press_submission: searchPressSubmissions,
};

/**
 * Ranks search results according to the contract rules:
 * 1. Fixed group order (goal -> workstream -> task -> agent -> ...)
 * 2. Inside a group:
 *    - Title starts with query (case-insensitive)
 *    - Title contains query (case-insensitive)
 *    - Match in another field
 *    - Ties go to most recently updated (handled by Prisma's `orderBy: { updatedAt: "desc" }`)
 */
export function rank(results: SearchResult[], q: string): SearchResult[] {
  const queryLower = q.toLowerCase().trim();

  return results.sort((a, b) => {
    // 1. Group order comparison
    const groupIndexA = groupOrder.indexOf(a.type);
    const groupIndexB = groupOrder.indexOf(b.type);
    if (groupIndexA !== groupIndexB) {
      return groupIndexA - groupIndexB;
    }

    // 2. Ranking criteria within the same group
    const scoreA = getMatchScore(a, queryLower);
    const scoreB = getMatchScore(b, queryLower);

    if (scoreA !== scoreB) {
      return scoreA - scoreB; // Lower score means higher priority (starts with -> contains -> other field)
    }

    return 0; // If tied, preserve order (DB already sorted by updatedAt desc)
  });
}

function getMatchScore(result: SearchResult, q: string): number {
  const titleLower = result.title.toLowerCase();
  if (titleLower.startsWith(q)) {
    return 1; // Highest priority
  }
  if (titleLower.includes(q)) {
    return 2; // Medium priority
  }
  return 3; // Lowest priority (matched in another field)
}

export async function runSearch({
  projectId,
  q,
  types,
  limit = 5,
}: {
  projectId: string;
  q: string;
  types?: SearchResultType[];
  limit?: number;
}): Promise<SearchResponse> {
  const trimmedQ = q.trim();
  const selectedTypes = types && types.length > 0 ? types : groupOrder;

  // Run selected searchers in parallel
  const searchPromises = selectedTypes.map(async (type) => {
    const searcher = searcherRegistry[type];
    if (!searcher) return [];
    try {
      return await searcher({ projectId, q: trimmedQ, limit });
    } catch (error) {
      console.error(`Error searching type ${type}:`, error);
      return [];
    }
  });

  const settledResults = await Promise.all(searchPromises);
  const flatResults = settledResults.flat();

  // Rank and return results
  const rankedResults = rank(flatResults, trimmedQ);

  return {
    query: trimmedQ,
    results: rankedResults,
  };
}
