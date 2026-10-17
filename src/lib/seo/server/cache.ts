// A small in-process cache with in-flight deduplication. Search Console and GA4
// update these reports a few times a day at most, so a 5-minute TTL keeps the
// dashboard fresh while protecting the Google API quotas. Per-instance only; no
// database is involved.

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

export function cached<T>(key: string, load: () => Promise<T>, options: { fresh?: boolean } = {}): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  // A forced refresh still joins a request that's already in flight.
  const inFlight = hit && hit.expiresAt === Infinity;
  if (hit && (inFlight || (!options.fresh && hit.expiresAt > now))) return hit.value as Promise<T>;

  const value = load();
  entries.set(key, { expiresAt: Infinity, value });
  const isCurrent = () => entries.get(key)?.value === value;
  value.then(
    () => isCurrent() && entries.set(key, { expiresAt: Date.now() + TTL_MS, value }),
    () => isCurrent() && entries.delete(key),
  );

  if (entries.size > MAX_ENTRIES) {
    for (const [k, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(k);
    }
    const oldest = entries.keys().next().value;
    if (entries.size > MAX_ENTRIES && oldest !== undefined) entries.delete(oldest);
  }
  return value;
}
