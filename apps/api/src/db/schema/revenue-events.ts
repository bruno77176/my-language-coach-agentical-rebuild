import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const revenueEvents = pgTable("revenue_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  userId: uuid("user_id").references(() => profiles.userId, {
    onDelete: "set null",
  }),
  platform: text("platform").notNull().default("unknown"),
  source: text("source").notNull(), // 'subscription' | 'iap' | 'ads'
  amountUsd: numeric("amount_usd", { precision: 10, scale: 4 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  meta: jsonb("meta"),
});

export type RevenueEvent = typeof revenueEvents.$inferSelect;
export type NewRevenueEvent = typeof revenueEvents.$inferInsert;
