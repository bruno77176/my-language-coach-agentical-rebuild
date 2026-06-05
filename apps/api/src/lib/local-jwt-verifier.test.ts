import { describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { createLocalJwtVerifier } from "./local-jwt-verifier";
import type { Verifier } from "../middleware/auth";

// A real ES256 keypair stands in for Supabase's signing key. The verifier is
// handed the matching public key, exactly as createRemoteJWKSet would supply
// in production — so these tests exercise real signature verification, not a
// mock of it.
async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const sign = (
    claims: Record<string, unknown>,
    opts?: { expired?: boolean; key?: CryptoKey },
  ) => {
    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt()
      .setExpirationTime(opts?.expired ? "-1h" : "1h");
    return jwt.sign(opts?.key ?? privateKey);
  };
  return { publicKey, privateKey, sign };
}

const neverCalledFallback: Verifier = async () => {
  throw new Error("fallback must not be called");
};

describe("createLocalJwtVerifier", () => {
  it("returns userId for a validly-signed token with email_verified=true", async () => {
    const { publicKey, sign } = await setup();
    const verify = createLocalJwtVerifier({
      key: () => publicKey,
      fallback: neverCalledFallback,
    });
    const token = await sign({ sub: "user-123", email_verified: true });
    await expect(verify(token)).resolves.toEqual({ userId: "user-123" });
  });

  it("rejects a token whose email_verified claim is false", async () => {
    // Regression guard for the 2026-05-28 incident: an unconfirmed-email user
    // must never get a session, even with a perfectly valid signature.
    const { publicKey, sign } = await setup();
    const verify = createLocalJwtVerifier({
      key: () => publicKey,
      fallback: neverCalledFallback,
    });
    const token = await sign({ sub: "user-456", email_verified: false });
    await expect(verify(token)).rejects.toThrow(/email not confirmed/i);
  });

  it("rejects a token signed by a different (wrong) key", async () => {
    const { publicKey, sign } = await setup();
    const other = await generateKeyPair("ES256");
    const verify = createLocalJwtVerifier({
      key: () => publicKey,
      fallback: neverCalledFallback,
    });
    const forged = await sign(
      { sub: "user-789", email_verified: true },
      { key: other.privateKey },
    );
    await expect(verify(forged)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { publicKey, sign } = await setup();
    const verify = createLocalJwtVerifier({
      key: () => publicKey,
      fallback: neverCalledFallback,
    });
    const token = await sign(
      { sub: "user-123", email_verified: true },
      { expired: true },
    );
    await expect(verify(token)).rejects.toThrow();
  });

  it("falls back to the network verifier when email_verified is absent", async () => {
    // Pre-hook tokens issued before the Custom Access Token hook was enabled
    // carry no email_verified claim. Until they refresh, the verifier defers to
    // the network getUser check so the email-confirm guard still holds.
    const { publicKey, sign } = await setup();
    const fallback = vi
      .fn<Verifier>()
      .mockResolvedValue({ userId: "user-123" });
    const verify = createLocalJwtVerifier({ key: () => publicKey, fallback });
    const token = await sign({ sub: "user-123" }); // no email_verified claim
    await expect(verify(token)).resolves.toEqual({ userId: "user-123" });
    expect(fallback).toHaveBeenCalledWith(token);
  });

  it("does not call the fallback when the claim is present", async () => {
    const { publicKey, sign } = await setup();
    const fallback = vi.fn<Verifier>();
    const verify = createLocalJwtVerifier({ key: () => publicKey, fallback });
    const token = await sign({ sub: "user-123", email_verified: true });
    await verify(token);
    expect(fallback).not.toHaveBeenCalled();
  });
});
