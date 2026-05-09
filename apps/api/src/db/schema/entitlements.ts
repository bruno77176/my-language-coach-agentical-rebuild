import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const entitlements = pgTable("entitlements", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  proUntil: timestamp("pro_until", { withTimezone: true }),
  monthlyVoiceSecondsUsed: integer("monthly_voice_seconds_used")
    .notNull()
    .default(0),
  monthlyVoiceSecondsResetAt: timestamp("monthly_voice_seconds_reset_at", {
    withTimezone: true,
  }).notNull(),
});

export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;
