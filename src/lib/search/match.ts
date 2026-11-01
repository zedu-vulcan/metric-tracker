/**
 * Shared match helper for Prisma queries.
 * Escapes LIKE wildcards (% and _) and the escape character (\) for a literal contains filter.
 */
export function textMatch(q: string) {
  const sanitized = q.replace(/[\\%_]/g, (match) => `\\${match}`);
  return {
    contains: sanitized,
    mode: "insensitive" as const,
  };
}
