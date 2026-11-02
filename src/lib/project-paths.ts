/** A dashboard path inside a project: `projectHref("acme", "/tasks")` → `/p/acme/tasks`. */
export function projectHref(slug: string, path = "") {
  return `/p/${slug}${path}`;
}
