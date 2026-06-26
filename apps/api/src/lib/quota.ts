import {
  FREE_TIER_VOICE_SECONDS_PER_MONTH,
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON,
  FREE_HONEYMOON_DAYS,
  PRO_TIER_VOICE_SECONDS_PER_DAY,
} from "../env";
import { localDayKey, nextLocalMidnightUtc } from "./daily-window";

export type Entitlement = {
  plan: "free" | "pro";
  proUntil: Date | null;
  monthlyVoiceSecondsUsed: number;
};

export type CanUseResult =
  | { allowed: true }
  | { allowed: false; reason: "QUOTA_EXCEEDED"; resetAt?: Date };

export function canUseSeconds(
  entitlement: Entitlement,
  estimatedSeconds: number,
): CanUseResult {
  const now = new Date();
  const isActivePro =
    entitlement.plan === "pro" &&
    entitlement.proUntil !== null &&
    entitlement.proUntil > now;
  if (isActivePro) return { allowed: true };

  const wouldUse = entitlement.monthlyVoiceSecondsUsed + estimatedSeconds;
  if (wouldUse <= FREE_TIER_VOICE_SECONDS_PER_MONTH) {
    return { allowed: true };
  }
  return { allowed: false, reason: "QUOTA_EXCEEDED" };
}

// Daily wall-clock cap (2026-06-10 rewrite).
//
// `dailyVoiceSecondsUsed` now means elapsed *conversation* seconds (the
// on-screen timer), accumulated from the client's per-turn elapsed delta — not
// transcribed-speech seconds. Both tiers are HARD caps:
//   - Free: FREE_TIER_VOICE_SECONDS_PER_DAY (5 min/day baseline; 10 min during
//           the first FREE_HONEYMOON_DAYS — see dailyCapSeconds/withinHoneymoon)
//   - Pro:  PRO_TIER_VOICE_SECONDS_PER_DAY  (60 min/day)
//
// The window resets at the user's LOCAL midnight (their profiles.timezone) via
// the day-key comparison in daily-window — so a user can't get a fresh
// allowance minutes after being blocked (the old rolling-24h bug). We block
// once the budget is already spent; the in-flight turn's time is added
// afterwards, so the final turn may overrun slightly (bounded by the per-turn
// clamp), which favors the user.

export type DailyEntitlement = {
  plan: "free" | "pro";
  proUntil: Date | null;
  dailyVoiceSecondsUsed: number;
  dailyResetAt: Date;
  // Account signup timestamp (profiles.created_at). Drives the free "honeymoon"
  // cap. Optional/nullable: when absent we fall back to the baseline free cap —
  // the safe (tighter) default, never accidentally generous.
  accountCreatedAt?: Date | null;
};

export type CanUseDailyResult =
  | { allowed: true }
  | { allowed: false; reason: "DAILY_QUOTA_EXCEEDED"; resetAt: Date };

/** Seconds used in the current local day (0 if the stored counter is stale). */
export function dailyUsed(
  entitlement: Pick<DailyEntitlement, "dailyVoiceSecondsUsed" | "dailyResetAt">,
  timeZone: string,
  now: Date,
): number {
  return localDayKey(entitlement.dailyResetAt, timeZone) ===
    localDayKey(now, timeZone)
    ? entitlement.dailyVoiceSecondsUsed
    : 0;
}

/**
 * True while the account is still inside its free "honeymoon" window — the
 * first FREE_HONEYMOON_DAYS (rolling, measured from signup). A missing
 * `createdAt` is treated as past the window (baseline cap). Clock skew that
 * makes the age negative still counts as in-window, which favors the user.
 */
function withinHoneymoon(
  createdAt: Date | null | undefined,
  now: Date,
): boolean {
  if (!createdAt) return false;
  const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return ageDays < FREE_HONEYMOON_DAYS;
}

/** Hard daily cap (seconds) for this entitlement at `now`. */
export function dailyCapSeconds(
  entitlement: Pick<DailyEntitlement, "plan" | "proUntil" | "accountCreatedAt">,
  now: Date,
): number {
  const isPro =
    entitlement.plan === "pro" &&
    entitlement.proUntil !== null &&
    entitlement.proUntil > now;
  if (isPro) return PRO_TIER_VOICE_SECONDS_PER_DAY;
  return withinHoneymoon(entitlement.accountCreatedAt, now)
    ? FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON
    : FREE_TIER_VOICE_SECONDS_PER_DAY;
}

export function canUseSecondsDaily(
  entitlement: DailyEntitlement,
  timeZone: string,
  nowOverride?: Date,
): CanUseDailyResult {
  const now = nowOverride ?? new Date();
  const used = dailyUsed(entitlement, timeZone, now);
  const cap = dailyCapSeconds(entitlement, now);
  if (used < cap) return { allowed: true };
  return {
    allowed: false,
    reason: "DAILY_QUOTA_EXCEEDED",
    resetAt: nextLocalMidnightUtc(now, timeZone),
  };
}
