/** Client-side JSON fetch that throws an Error with the API's message, so forms can show it. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message && message !== "Validation failed" ? message : "Something went wrong. Try again.");
  }
  return body as T;
}
