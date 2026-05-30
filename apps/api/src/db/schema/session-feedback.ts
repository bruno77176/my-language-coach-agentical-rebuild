import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

export const sessionFeedback = pgTable("session_feedback", {
  conversationId: uuid("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
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
