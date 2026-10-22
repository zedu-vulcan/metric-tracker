/**
 * Shared match helper for Prisma queries.
 * Escapes special LIKE wildcard characters (% and _) and returns an insensitive contains filter.
 */
export function textMatch(q: string) {
  const sanitized = q.replace(/[%_]/g, (match) => `\\${match}`);
  return {
    contains: sanitized,
    mode: "insensitive" as const,
  };
}
