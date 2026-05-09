import { FREE_TIER_VOICE_SECONDS_PER_MONTH } from "../env";

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
