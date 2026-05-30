import type { Database } from "../db";

export const FEATURES = {
  COACH_MEMORY_DEEP: "coach_memory_deep",
  FEEDBACK_HISTORY: "feedback_history",
  FEEDBACK_AUDIO: "feedback_audio",
  ROLEPLAY_PREMIUM: "roleplay_premium",
  WEEKLY_DIGEST_EMAIL: "weekly_digest_email",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export type FeatureDeps = { db: Database };

export async function canUseFeature(
  userId: string,
  feature: Feature,
  deps: FeatureDeps,
): Promise<boolean> {
  const ent = await deps.db.query.entitlements.findFirst({
    where: (t: any, { eq: e }: any) => e(t.userId, userId),
  });
  if (!ent) return false;
  if (ent.plan !== "pro") return false;
  if (!ent.proUntil || new Date(ent.proUntil) <= new Date()) return false;
  // All listed features are Pro-only; no per-feature toggling yet.
  void feature;
  return true;
}
