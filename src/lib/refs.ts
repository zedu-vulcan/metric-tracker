/** Short per-project references people paste to their agents: G-12 (goal), I-7 (idea or workstream), T-341 (task). */
export const REF_KINDS = { goal: "G", idea: "I", task: "T" } as const;

export type RefKind = keyof typeof REF_KINDS;

const KIND_BY_PREFIX = Object.fromEntries(Object.entries(REF_KINDS).map(([kind, prefix]) => [prefix, kind])) as Record<
  string,
  RefKind
>;

export const REF_PATTERN = /^\s*#?([GIT])-?(\d{1,9})\s*$/i;

export function formatRef(kind: RefKind, number: number) {
  return `${REF_KINDS[kind]}-${number}`;
}

/** Reads "T-341", "t341" or "#T-341"; null for anything else. */
export function parseRef(text: string): { kind: RefKind; number: number; ref: string } | null {
  const match = REF_PATTERN.exec(text);
  if (!match) return null;
  const kind = KIND_BY_PREFIX[match[1].toUpperCase()];
  const number = Number(match[2]);
  if (!kind || number < 1) return null;
  return { kind, number, ref: formatRef(kind, number) };
}

const KIND_LABELS: Record<RefKind, string> = { goal: "goal", idea: "idea", task: "task" };

/**
 * What the copy buttons put on the clipboard: the reference, its title and where it stands, a link for people,
 * and the lookup an agent can call. Agents that know Amp only need the first line.
 */
export function agentSnippet({
  kind,
  ref,
  title,
  status,
  parent,
  origin,
  projectSlug,
}: {
  kind: RefKind;
  ref: string;
  title: string;
  status?: string;
  parent?: { ref: string; title: string; label: string };
  origin: string;
  projectSlug: string;
}) {
  const context = [status && `Status: ${status}.`, parent && `${parent.label} ${parent.ref}: ${parent.title}.`]
    .filter(Boolean)
    .join(" ");
  return [
    `Amp ${KIND_LABELS[kind]} ${ref}: ${title}`,
    context,
    `Link: ${origin}/p/${projectSlug}/${ref}`,
    `Details: GET ${origin}/api/refs/${ref} with your Amp agent key.`,
  ]
    .filter(Boolean)
    .join("\n");
}
