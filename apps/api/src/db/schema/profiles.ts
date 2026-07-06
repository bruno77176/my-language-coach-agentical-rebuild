import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  nativeLang: text("native_lang").notNull(),
  targetLang: text("target_lang").notNull(),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
  timezone: text("timezone").notNull(),
  // Global coach-memory consent: one switch governs whether any coach
  // remembers this user, across every language.
  memoryEnabled: boolean("memory_enabled").notNull().default(true),
  // Self-declared CEFR level per target language, e.g. {"es":"B1","ja":"A1"}.
  // Set at onboarding / in the profile; used as the coach's level until the AI
  // infers one from actual conversations (seed-then-refine). See set_my_level().
  selfDeclaredLevels: jsonb("self_declared_levels")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
