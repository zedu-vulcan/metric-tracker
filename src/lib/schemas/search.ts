import { z } from "@/lib/zod";

export const searchResultTypes = [
  "goal",
  "workstream",
  "task",
  "agent",
  "directory",
  "content",
  "press_outlet",
  "press_coverage",
  "press_submission",
] as const;

export type SearchResultType = (typeof searchResultTypes)[number];

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Query must be at least 2 characters")
    .max(100, "Query is too long")
    .openapi({
      description: "Search query string (2 to 100 characters)",
    }),
  types: z
    .string()
    .optional()
    .transform((val) =>
      val ? (val.split(",") as SearchResultType[]) : undefined,
    )
    .openapi({
      description: "Comma-separated list of result types to filter by",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .openapi({ description: "Maximum number of results per type (1 to 10)" }),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  matchedField: string;
  href: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export type Searcher = (ctx: {
  projectId: string;
  q: string;
  limit: number;
}) => Promise<SearchResult[]>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.custom<SearchResult>().array(),
});
