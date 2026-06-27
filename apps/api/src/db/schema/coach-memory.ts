import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const coachMemory = pgTable(
  "coach_memory",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull(),
    proficiencyLevel: text("proficiency_level"),
    recentTopics: jsonb("recent_topics").notNull().default([]),
    weakAreas: jsonb("weak_areas").notNull().default([]),
    personalContext: jsonb("personal_context").notNull().default({}),
    lastSessionSummary: text("last_session_summary"),
    nextPlan: jsonb("next_plan"),
    nextPlanGeneratedAt: timestamp("next_plan_generated_at", {
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.languageCode] }),
  }),
);

export type CoachMemoryRow = typeof coachMemory.$inferSelect;
export type NewCoachMemoryRow = typeof coachMemory.$inferInsert;
