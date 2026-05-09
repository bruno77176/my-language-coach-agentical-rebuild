import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userTokenUnique: unique("push_tokens_user_token_unique").on(
      t.userId,
      t.expoPushToken,
    ),
  }),
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
