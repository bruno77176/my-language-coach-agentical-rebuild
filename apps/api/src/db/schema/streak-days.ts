import {
  pgTable,
  uuid,
  date,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const streakDays = pgTable(
  "streak_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    date: date("date").notNull(),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
    goalReached: boolean("goal_reached").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date] }),
  }),
);

export type StreakDay = typeof streakDays.$inferSelect;
export type NewStreakDay = typeof streakDays.$inferInsert;
