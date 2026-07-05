import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { profiles } from "./profiles";

// A checkpoint slices a continuous per-language thread into a "practice
// segment." It is the unit feedback + coach-memory + streak attach to, now that
// free-form threads never "end." One checkpoint is created per "Wrap up & get
// feedback" action and per inactivity auto-checkpoint. Role-play scenarios do
// NOT use checkpoints — they keep the conversation-level /end path.
export const sessionCheckpoints = pgTable(
  "session_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    // The segment covered: (previous checkpoint's ended_at, or thread start] → ended_at.
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userEndedIdx: index("checkpoints_user_ended_idx").on(
      t.userId,
      t.endedAt.desc(),
    ),
    convEndedIdx: index("checkpoints_conv_ended_idx").on(
      t.conversationId,
      t.endedAt.desc(),
    ),
    // One checkpoint per segment start → concurrent same-segment checkpoints
    // can't double-fire streak/feedback/digest.
    convStartUniq: uniqueIndex("session_checkpoints_conv_start_uniq").on(
      t.conversationId,
      t.startedAt,
    ),
  }),
);

export type SessionCheckpoint = typeof sessionCheckpoints.$inferSelect;
export type NewSessionCheckpoint = typeof sessionCheckpoints.$inferInsert;
