import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(),
  userId: uuid("user_id").references(() => profiles.userId, {
    onDelete: "set null",
  }),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
