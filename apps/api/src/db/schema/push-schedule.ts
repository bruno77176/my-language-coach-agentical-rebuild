import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./profiles";

export const pushSchedule = pgTable(
  "push_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    payload: jsonb("payload").notNull().default({}),
  },
  (t) => ({
    sendAtIdx: index("push_schedule_send_at_idx").on(t.sendAt),
    // At most one PENDING inactivity reminder per user (see migration 0024).
    pendingInactivityUniq: uniqueIndex("push_schedule_pending_inactivity_uniq")
      .on(t.userId)
      .where(
        sql`kind = 'inactivity-reminder' AND sent_at IS NULL AND cancelled_at IS NULL`,
      ),
  }),
);

export type PushScheduleRow = typeof pushSchedule.$inferSelect;
export type NewPushScheduleRow = typeof pushSchedule.$inferInsert;
