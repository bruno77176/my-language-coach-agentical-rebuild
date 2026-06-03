import { SignJWT, importPKCS8 } from "jose";

/**
 * Mints Google Cloud access tokens from a service-account key, for calling the
 * Cloud Text-to-Speech API (GA Gemini-TTS rejects API keys — it requires an
 * OAuth2 principal). Uses the JWT-bearer grant signed with `jose` (already a
 * dependency) so we add no new package on the tiny prod machine.
 *
 * The returned function caches the token until shortly before it expires and
 * refreshes on demand.
 */
type ServiceAccount = { client_email: string; private_key: string };

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type AccessTokenProvider = () => Promise<string>;

export function makeGoogleAccessTokenProvider(
  serviceAccountJson: string,
): AccessTokenProvider {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON missing client_email/private_key");
  }

  let cached: { token: string; expEpoch: number } | null = null;
  let inFlight: Promise<string> | null = null;

  async function fetchToken(): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    const key = await importPKCS8(sa.private_key, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(TOKEN_ENDPOINT)
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 3600)
      .sign(key);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Google token exchange ${res.status}: ${detail}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    cached = {
      token: json.access_token,
      expEpoch: nowSec + json.expires_in,
    };
    return json.access_token;
  }

  return async function getAccessToken(): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    // Reuse the cached token until 60s before expiry.
    if (cached && cached.expEpoch - 60 > nowSec) return cached.token;
    // Coalesce concurrent refreshes into one token exchange.
    if (!inFlight) {
      inFlight = fetchToken().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
