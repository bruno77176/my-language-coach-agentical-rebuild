import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { conversations } from "./conversations";
import { sessionCheckpoints } from "./session-checkpoints";

export const digestJobs = pgTable("digest_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  // The column-level `.unique()` was dropped in migration 0021: a continuous
  // thread enqueues one digest per checkpoint, so conversation_id repeats.
  // Idempotency is now partial-unique per row type (conversation_id for
  // scenario/legacy, checkpoint_id for thread checkpoints).
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  checkpointId: uuid("checkpoint_id").references(() => sessionCheckpoints.id, {
    onDelete: "cascade",
  }),
  languageCode: text("language_code").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DigestJobRow = typeof digestJobs.$inferSelect;
export type NewDigestJobRow = typeof digestJobs.$inferInsert;
