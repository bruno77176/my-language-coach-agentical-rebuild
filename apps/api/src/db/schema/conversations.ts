import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { topics } from "./topics";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    scenarioId: text("scenario_id"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
  },
  (t) => ({
    userStartedIdx: index("conversations_user_started_idx").on(
      t.userId,
      t.startedAt.desc(),
    ),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
