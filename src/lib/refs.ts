/** Short per-project task references people paste to their agents, e.g. T-341. */
export const REF_PREFIX = "T";

export const REF_PATTERN = /^\s*#?T-?(\d{1,9})\s*$/i;

export function formatRef(number: number) {
  return `${REF_PREFIX}-${number}`;
}

/** Reads "T-341", "t341" or "#T-341"; null for anything else. */
export function parseRef(text: string): { number: number; ref: string } | null {
  const match = REF_PATTERN.exec(text);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1) return null;
  return { number, ref: formatRef(number) };
}

/**
 * What the copy buttons put on the clipboard: the reference, its title and where it stands, a link for people,
 * and the lookup an agent can call. Agents that know Amp only need the first line.
 */
export function agentSnippet({
  ref,
  title,
  status,
  origin,
  projectSlug,
}: {
  ref: string;
  title: string;
  status?: string;
  origin: string;
  projectSlug: string;
}) {
  return [
    `Amp task ${ref}: ${title}`,
    status && `Status: ${status}.`,
    `Link: ${origin}/p/${projectSlug}/${ref}`,
    `Details: GET ${origin}/api/refs/${ref} with your Amp agent key.`,
  ]
    .filter(Boolean)
    .join("\n");
}
