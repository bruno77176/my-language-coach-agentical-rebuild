import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { messages } from "./messages";

export const vocabItems = pgTable(
  "vocab_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    term: text("term").notNull(),
    translation: text("translation"),
    firstSeenMessageId: uuid("first_seen_message_id").references(
      () => messages.id,
      {
        onDelete: "set null",
      },
    ),
    mastery: integer("mastery").notNull().default(0),
    starred: boolean("starred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userLangTermUnique: unique("vocab_user_lang_term_unique").on(
      t.userId,
      t.language,
      t.term,
    ),
  }),
);

export type VocabItem = typeof vocabItems.$inferSelect;
export type NewVocabItem = typeof vocabItems.$inferInsert;
