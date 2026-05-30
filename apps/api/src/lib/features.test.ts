import { describe, expect, it, vi } from "vitest";
import { canUseFeature, FEATURES } from "./features";

/* eslint-disable @typescript-eslint/no-explicit-any */

const mkDb = (entitlement: any) =>
  ({
    query: {
      entitlements: { findFirst: vi.fn(async () => entitlement) },
    },
  }) as any;

describe("canUseFeature", () => {
  it("returns false for free plan on Pro feature", async () => {
    const db = mkDb({ plan: "free", proUntil: null });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
  it("returns true for active Pro plan", async () => {
    const future = new Date(Date.now() + 7 * 86400 * 1000);
    const db = mkDb({ plan: "pro", proUntil: future });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      true,
    );
  });
  it("returns false when Pro plan is expired", async () => {
    const past = new Date(Date.now() - 86400 * 1000);
    const db = mkDb({ plan: "pro", proUntil: past });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
  it("returns false when no entitlement row exists", async () => {
    const db = mkDb(null);
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
});
