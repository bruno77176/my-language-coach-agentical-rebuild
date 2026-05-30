import { z } from "zod";
import { eq } from "drizzle-orm";
import { entitlements } from "../db/schema";
import type { Database } from "../db";

export const RevenueCatEventSchema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    expiration_at_ms: z.number().nullable().optional(),
    product_id: z.string().optional(),
  }),
});

export type RevenueCatEvent = z.infer<typeof RevenueCatEventSchema>;

const ACTIVATING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);
const DEACTIVATING = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
]);

export async function applyRevenueCatEvent(
  db: Database,
  event: RevenueCatEvent["event"],
): Promise<void> {
  const userId = event.app_user_id;
  if (!userId) return;
  if (ACTIVATING.has(event.type)) {
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : new Date(Date.now() + 31 * 86400 * 1000); // safety default
    await db
      .update(entitlements)
      .set({ plan: "pro", proUntil: expiresAt })
      .where(eq(entitlements.userId, userId));
    return;
  }
  if (DEACTIVATING.has(event.type)) {
    await db
      .update(entitlements)
      .set({ plan: "free", proUntil: null })
      .where(eq(entitlements.userId, userId));
    return;
  }
  // Other event types (TEST, NON_RENEWING_PURCHASE) are no-ops for now.
}
