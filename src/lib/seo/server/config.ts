// Reads the SEO analytics configuration. Server-only: never import from a client component.

export interface GoogleServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export type SeoConfig<T> = { ok: true; value: T } | { ok: false; missing: string[] };

/** Demo data is a development aid only; it can never switch on in production. */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SEO_ANALYTICS_DEMO === "true";
}

function serviceAccount(missing: string[]): GoogleServiceAccount | null {
  const clientEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL?.trim();
  // Hosting dashboards often store multi-line keys with literal "\n" sequences.
  const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientEmail) missing.push("GOOGLE_ANALYTICS_CLIENT_EMAIL");
  if (!privateKey) missing.push("GOOGLE_ANALYTICS_PRIVATE_KEY");
  return clientEmail && privateKey ? { clientEmail, privateKey } : null;
}

export function searchConsoleConfig(): SeoConfig<{ account: GoogleServiceAccount; siteUrl: string }> {
  const missing: string[] = [];
  const account = serviceAccount(missing);
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  if (!siteUrl) missing.push("GSC_SITE_URL");
  return account && siteUrl ? { ok: true, value: { account, siteUrl } } : { ok: false, missing };
}

export function analyticsConfig(): SeoConfig<{ account: GoogleServiceAccount; propertyId: string }> {
  const missing: string[] = [];
  const account = serviceAccount(missing);
  // Accept "123456789" or "properties/123456789".
  const propertyId = process.env.GA4_PROPERTY_ID?.trim().replace(/^properties\//, "");
  if (!propertyId) missing.push("GA4_PROPERTY_ID");
  return account && propertyId ? { ok: true, value: { account, propertyId } } : { ok: false, missing };
}
