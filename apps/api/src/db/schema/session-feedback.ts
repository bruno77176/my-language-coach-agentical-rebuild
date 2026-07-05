import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { sessionCheckpoints } from "./session-checkpoints";

export const sessionFeedback = pgTable("session_feedback", {
  // No longer a primary key: a continuous thread has many checkpoints, each with
  // its own feedback row (same conversation_id, distinct checkpoint_id). Dedup is
  // enforced by partial unique indexes in migration 0021:
  //   - scenario/legacy rows (checkpoint_id NULL) are unique on conversation_id
  //   - thread rows are unique on checkpoint_id
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  // Set for continuous-thread feedback; NULL for scenario/legacy /end feedback.
  checkpointId: uuid("checkpoint_id").references(() => sessionCheckpoints.id, {
    onDelete: "cascade",
  }),
  highlights: jsonb("highlights").notNull().default([]),
  corrections: jsonb("corrections").notNull().default([]),
  vocab: jsonb("vocab").notNull().default([]),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SessionFeedbackRow = typeof sessionFeedback.$inferSelect;
export type NewSessionFeedbackRow = typeof sessionFeedback.$inferInsert;
