import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  signDeletionToken,
  verifyDeletionToken,
} from "./account-deletion-token";

const secret = "a".repeat(64); // 32 bytes hex
const userId = "00000000-0000-0000-0000-000000000001";

describe("account-deletion JWT", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("signs and verifies a token round-trip", async () => {
    const token = await signDeletionToken(secret, userId);
    const payload = await verifyDeletionToken(secret, token);
    expect(payload.userId).toBe(userId);
  });

  it("rejects an expired token", async () => {
    const token = await signDeletionToken(secret, userId);
    vi.setSystemTime(new Date("2026-05-31T12:00:01Z")); // +48h
    await expect(verifyDeletionToken(secret, token)).rejects.toThrow();
  });

  it("rejects a tampered signature", async () => {
    const token = await signDeletionToken(secret, userId);
    const tampered = token.slice(0, -4) + "XXXX";
    await expect(verifyDeletionToken(secret, tampered)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signDeletionToken(secret, userId);
    await expect(verifyDeletionToken("b".repeat(64), token)).rejects.toThrow();
  });

  it("rejects a token with the wrong purpose claim", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(secret);
    const bad = await new SignJWT({ userId, purpose: "something-else" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(key);
    await expect(verifyDeletionToken(secret, bad)).rejects.toThrow();
  });
});
