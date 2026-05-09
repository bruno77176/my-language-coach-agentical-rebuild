import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  nativeLang: text("native_lang").notNull(),
  targetLang: text("target_lang").notNull(),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
