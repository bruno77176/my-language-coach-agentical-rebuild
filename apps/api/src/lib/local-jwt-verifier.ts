import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../env";
import type { Verifier } from "../middleware/auth";
import { createSupabaseVerifier } from "./supabase-verifier";

export type LocalJwtVerifierOptions = {
  // The verification key: in production a `createRemoteJWKSet(...)` resolver
  // (cached, fetched once per signing key); in tests a public CryptoKey. Either
  // is accepted directly by `jwtVerify`.
  key: Parameters<typeof jwtVerify>[1];
  // Network verifier used only as a transitional fallback for tokens issued
  // before the Custom Access Token hook existed (no email_verified claim).
  fallback: Verifier;
};

// Verifies a Supabase access token locally by checking its ES256 signature
// against the project JWKS — no per-turn network round-trip to Supabase Auth.
// The email-confirm guard (the 2026-05-28 incident defense) is preserved via
// the `email_verified` claim that our Supabase custom-access-token hook stamps.
export function createLocalJwtVerifier(
  opts: LocalJwtVerifierOptions,
): Verifier {
  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, opts.key, {
        algorithms: ["ES256"],
      }));
    } catch (err) {
      throw new Error(`Invalid JWT: ${(err as Error).message}`);
    }

    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!sub) throw new Error("JWT missing sub claim");

    const emailVerified = payload.email_verified;
    if (emailVerified === true) return { userId: sub };
    if (emailVerified === false) throw new Error("Email not confirmed");

    // Claim absent: this token predates the custom-access-token hook. Defer to
    // the network verifier so the email-confirm guard still holds until the
    // client's token refreshes (Supabase rotates access tokens ~hourly).
    return opts.fallback(token);
  };
}

// Production wiring: verify against the project's published JWKS (ES256), with
// the network getUser verifier as the transitional fallback. The JWKS resolver
// is created once per process and caches keys, so steady-state verification is
// pure CPU — no Supabase round-trip on the per-turn hot path.
export function createSupabaseLocalVerifier(env: Env): Verifier {
  const jwksUrl = new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  return createLocalJwtVerifier({
    key: createRemoteJWKSet(jwksUrl),
    fallback: createSupabaseVerifier(env),
  });
}
