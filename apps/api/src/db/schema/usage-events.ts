import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").references(() => profiles.userId, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull().default("unknown"),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    units: numeric("units", { precision: 18, scale: 6 }).notNull(),
    unitType: text("unit_type").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    rateCardId: uuid("rate_card_id"),
    conversationId: uuid("conversation_id"),
    meta: jsonb("meta"),
  },
  (t) => ({
    createdAtIdx: index("usage_events_created_at_idx").on(t.createdAt),
    userCreatedIdx: index("usage_events_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    providerCreatedIdx: index("usage_events_provider_created_idx").on(
      t.provider,
      t.createdAt,
    ),
    platformCreatedIdx: index("usage_events_platform_created_idx").on(
      t.platform,
      t.createdAt,
    ),
  }),
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
