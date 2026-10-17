import { createSign } from "node:crypto";
import type { GoogleServiceAccount } from "./config";
import { SeoApiError, googleError } from "./errors";

// Service-account OAuth (JWT bearer grant, RFC 7523) using Node's crypto, so the
// project doesn't need the googleapis SDK for two read-only reports.
// https://developers.google.com/identity/protocols/oauth2/service-account#httprest

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const SCOPES = {
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
} as const;

const tokens = new Map<string, { accessToken: string; expiresAt: number }>();

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function signedAssertion(account: GoogleServiceAccount, scope: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.clientEmail, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const unsigned = `${header}.${claims}`;

  try {
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey);
    return `${unsigned}.${base64url(signature)}`;
  } catch {
    throw new SeoApiError(
      "invalid_credentials",
      "GOOGLE_ANALYTICS_PRIVATE_KEY isn't a valid PEM private key. Copy the private_key value from the service account's JSON key file.",
    );
  }
}

export async function getAccessToken(account: GoogleServiceAccount, scope: string): Promise<string> {
  const key = `${account.clientEmail}|${scope}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken;

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedAssertion(account, scope),
      }),
      cache: "no-store",
    });
  } catch {
    throw new SeoApiError("upstream_error", "Couldn't reach Google's OAuth server.");
  }

  if (!response.ok) {
    const error = await googleError(response, "Google OAuth");
    // The token endpoint answers bad keys and unknown accounts with 400.
    throw response.status === 400 ? new SeoApiError("invalid_credentials", error.details) : error;
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  tokens.set(key, { accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}
