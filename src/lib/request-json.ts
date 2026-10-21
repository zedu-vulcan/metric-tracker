/** Header naming the project a dashboard request is for (matches `PROJECT_HEADER` on the server). */
const PROJECT_HEADER = "x-project-id";

let activeProjectId: string | null = null;

/** Set by `ProjectProvider`, so every API call from the page is scoped to the project it shows. */
export function setActiveProject(projectId: string | null) {
  activeProjectId = projectId;
}

/** `fetch` for this app's API: adds the active project's header to `/api/` requests. */
export function apiFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (activeProjectId && input.startsWith("/api/") && !headers.has(PROJECT_HEADER)) {
    headers.set(PROJECT_HEADER, activeProjectId);
  }
  return fetch(input, { ...init, headers });
}

/** Client-side JSON fetch that throws an Error with the API's message, so forms can show it. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await apiFetch(url, { ...init, headers });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message && message !== "Validation failed" ? message : "Something went wrong. Try again.");
  }
  return body as T;
}
