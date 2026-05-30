import { describe, expect, it } from "vitest";
import { canUseSeconds, canUseSecondsDaily } from "./quota";
import {
  FREE_TIER_VOICE_SECONDS_PER_MONTH,
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP,
} from "../env";

describe("canUseSeconds", () => {
  it("allows pro users always", () => {
    const future = new Date(Date.now() + 86400000);
    expect(
      canUseSeconds(
        {
          plan: "pro",
          proUntil: future,
          monthlyVoiceSecondsUsed: 999999,
        },
        60,
      ),
    ).toEqual({ allowed: true });
  });

  it("treats expired pro as free", () => {
    const past = new Date(Date.now() - 86400000);
    const r = canUseSeconds(
      {
        plan: "pro",
        proUntil: past,
        monthlyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_MONTH + 1,
      },
      1,
    );
    expect(r.allowed).toBe(false);
  });

  it("allows free user under the cap", () => {
    expect(
      canUseSeconds(
        { plan: "free", proUntil: null, monthlyVoiceSecondsUsed: 600 },
        30,
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects free user over the cap", () => {
    const r = canUseSeconds(
      {
        plan: "free",
        proUntil: null,
        monthlyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_MONTH - 5,
      },
      30,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("QUOTA_EXCEEDED");
  });
});

describe("canUseSecondsDaily", () => {
  const now = new Date("2026-05-30T12:00:00.000Z");

  it("allows free user under the daily cap", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: 100,
        dailyResetAt: new Date(now.getTime() - 60_000), // 1 minute ago
      },
      60,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("rejects free user at the daily cap with DAILY_QUOTA_EXCEEDED + future resetAt", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY - 5,
        dailyResetAt: new Date(now.getTime() - 60_000),
      },
      30,
      now,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe("DAILY_QUOTA_EXCEEDED");
      expect(r.resetAt.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("treats dailyVoiceSecondsUsed as 0 once 24h reset window has passed", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY, // would normally exhaust
        dailyResetAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25h ago
      },
      60,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("allows active Pro under the soft cap with no warn flag", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() + 86400000),
        dailyVoiceSecondsUsed: 100,
        dailyResetAt: new Date(now.getTime() - 60_000),
      },
      60,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("allows active Pro over the soft cap but sets warnSoftCap=true", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() + 86400000),
        dailyVoiceSecondsUsed: PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP,
        dailyResetAt: new Date(now.getTime() - 60_000),
      },
      60,
      now,
    );
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.warnSoftCap).toBe(true);
  });

  it("treats expired Pro as free (uses free daily cap)", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() - 86400000), // expired
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY - 5,
        dailyResetAt: new Date(now.getTime() - 60_000),
      },
      30,
      now,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("DAILY_QUOTA_EXCEEDED");
  });
});
