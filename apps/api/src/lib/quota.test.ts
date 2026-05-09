import { describe, expect, it } from "vitest";
import { canUseSeconds } from "./quota";
import { FREE_TIER_VOICE_SECONDS_PER_MONTH } from "../env";

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
