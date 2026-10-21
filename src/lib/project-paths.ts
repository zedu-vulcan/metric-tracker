/** A dashboard path inside a project: `projectHref("acme", "/goals")` → `/p/acme/goals`. */
export function projectHref(slug: string, path = "") {
  return `/p/${slug}${path}`;
}
