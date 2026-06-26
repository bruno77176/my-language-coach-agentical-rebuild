import { describe, expect, it } from "vitest";
import { canUseSeconds, canUseSecondsDaily, dailyCapSeconds } from "./quota";
import {
  FREE_TIER_VOICE_SECONDS_PER_MONTH,
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON,
  PRO_TIER_VOICE_SECONDS_PER_DAY,
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

describe("canUseSecondsDaily (wall-clock, hard caps, local-midnight reset)", () => {
  // Noon UTC — same local day in UTC as the dailyResetAt below.
  const now = new Date("2026-05-30T12:00:00.000Z");
  const tz = "UTC";
  const earlierSameDay = new Date("2026-05-30T08:00:00.000Z");

  it("allows a free user under the daily cap", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: 100,
        dailyResetAt: earlierSameDay,
      },
      tz,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("blocks a free user at the daily cap with DAILY_QUOTA_EXCEEDED + next-local-midnight resetAt", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY,
        dailyResetAt: earlierSameDay,
      },
      tz,
      now,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toBe("DAILY_QUOTA_EXCEEDED");
      // Next local (UTC) midnight after 2026-05-30 noon = 2026-05-31T00:00Z.
      expect(r.resetAt.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    }
  });

  it("treats usage as 0 on a new local day (stale counter from a prior day)", () => {
    const r = canUseSecondsDaily(
      {
        plan: "free",
        proUntil: null,
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY, // would exhaust if counted
        dailyResetAt: new Date("2026-05-29T20:00:00.000Z"), // previous local day
      },
      tz,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("allows active Pro under the 60-min cap", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() + 86400000),
        dailyVoiceSecondsUsed: PRO_TIER_VOICE_SECONDS_PER_DAY - 1,
        dailyResetAt: earlierSameDay,
      },
      tz,
      now,
    );
    expect(r).toEqual({ allowed: true });
  });

  it("hard-blocks active Pro at the 60-min cap (no soft overage)", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() + 86400000),
        dailyVoiceSecondsUsed: PRO_TIER_VOICE_SECONDS_PER_DAY,
        dailyResetAt: earlierSameDay,
      },
      tz,
      now,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("DAILY_QUOTA_EXCEEDED");
  });

  it("treats expired Pro as free (uses the free daily cap)", () => {
    const r = canUseSecondsDaily(
      {
        plan: "pro",
        proUntil: new Date(now.getTime() - 86400000), // expired
        dailyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_DAY,
        dailyResetAt: earlierSameDay,
      },
      tz,
      now,
    );
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("DAILY_QUOTA_EXCEEDED");
  });

  it("grants the honeymoon cap to a brand-new free account (used between baseline and honeymoon)", () => {
    // 400s used: over the 300s baseline but under the 600s honeymoon cap. A
    // fresh account should still be allowed; an old account would be blocked.
    const base = {
      plan: "free" as const,
      proUntil: null,
      dailyVoiceSecondsUsed: 400,
      dailyResetAt: earlierSameDay,
    };
    const fresh = canUseSecondsDaily(
      { ...base, accountCreatedAt: now }, // signed up today → honeymoon
      tz,
      now,
    );
    expect(fresh).toEqual({ allowed: true });

    const old = canUseSecondsDaily(
      {
        ...base,
        accountCreatedAt: new Date(now.getTime() - 10 * 86_400_000), // 10 days old
      },
      tz,
      now,
    );
    expect(old.allowed).toBe(false);
    if (!old.allowed) expect(old.reason).toBe("DAILY_QUOTA_EXCEEDED");
  });
});

describe("dailyCapSeconds (honeymoon → baseline)", () => {
  const now = new Date("2026-06-26T12:00:00.000Z");
  const day = 86_400_000;

  it("returns the honeymoon cap inside the first days", () => {
    expect(
      dailyCapSeconds(
        { plan: "free", proUntil: null, accountCreatedAt: now },
        now,
      ),
    ).toBe(FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON);
    expect(
      dailyCapSeconds(
        {
          plan: "free",
          proUntil: null,
          accountCreatedAt: new Date(now.getTime() - 2 * day), // day 2, still in window
        },
        now,
      ),
    ).toBe(FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON);
  });

  it("drops to the baseline cap once the honeymoon ends", () => {
    expect(
      dailyCapSeconds(
        {
          plan: "free",
          proUntil: null,
          accountCreatedAt: new Date(now.getTime() - 3 * day), // day 3 → window over
        },
        now,
      ),
    ).toBe(FREE_TIER_VOICE_SECONDS_PER_DAY);
  });

  it("falls back to the baseline cap when signup date is unknown", () => {
    expect(dailyCapSeconds({ plan: "free", proUntil: null }, now)).toBe(
      FREE_TIER_VOICE_SECONDS_PER_DAY,
    );
    expect(
      dailyCapSeconds(
        { plan: "free", proUntil: null, accountCreatedAt: null },
        now,
      ),
    ).toBe(FREE_TIER_VOICE_SECONDS_PER_DAY);
  });

  it("ignores the honeymoon for active Pro (always the Pro cap)", () => {
    expect(
      dailyCapSeconds(
        {
          plan: "pro",
          proUntil: new Date(now.getTime() + day),
          accountCreatedAt: now, // even a brand-new Pro account
        },
        now,
      ),
    ).toBe(PRO_TIER_VOICE_SECONDS_PER_DAY);
  });
});
