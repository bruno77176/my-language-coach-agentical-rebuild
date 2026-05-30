import {
  FREE_TIER_VOICE_SECONDS_PER_MONTH,
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP,
} from "../env";

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

// Plan 8 M4: daily quota.
//
// Free users: hard cap at FREE_TIER_VOICE_SECONDS_PER_DAY (10 min/day).
// Pro users: soft cap at PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP (60 min/day);
// requests above the soft cap are still allowed but flagged via warnSoftCap.
//
// The 24h reset window is computed off the per-row daily_reset_at timestamp,
// so no external cron is required — the reset happens lazily here and the
// caller is expected to persist the new reset time + zeroed counter on the
// next successful turn.

export type DailyEntitlement = {
  plan: "free" | "pro";
  proUntil: Date | null;
  dailyVoiceSecondsUsed: number;
  dailyResetAt: Date;
};

export type CanUseDailyResult =
  | { allowed: true; warnSoftCap?: boolean }
  | { allowed: false; reason: "DAILY_QUOTA_EXCEEDED"; resetAt: Date };

export function canUseSecondsDaily(
  entitlement: DailyEntitlement,
  estimatedSeconds: number,
  nowOverride?: Date,
): CanUseDailyResult {
  const now = nowOverride ?? new Date();
  // If reset window has passed, treat dailyVoiceSecondsUsed as 0
  const used =
    entitlement.dailyResetAt.getTime() + 24 * 60 * 60 * 1000 < now.getTime()
      ? 0
      : entitlement.dailyVoiceSecondsUsed;
  const wouldUse = used + estimatedSeconds;

  const isPro =
    entitlement.plan === "pro" &&
    entitlement.proUntil !== null &&
    entitlement.proUntil > now;

  if (isPro) {
    const cap = PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP;
    if (wouldUse <= cap) return { allowed: true };
    return { allowed: true, warnSoftCap: true }; // soft cap: still allow
  }

  if (wouldUse <= FREE_TIER_VOICE_SECONDS_PER_DAY) return { allowed: true };
  const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { allowed: false, reason: "DAILY_QUOTA_EXCEEDED", resetAt };
}
