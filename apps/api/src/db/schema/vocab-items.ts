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
    // The phrase the word was saved from — shown in review for context (BRU-11).
    sourceSentence: text("source_sentence"),
    // Definite article for gendered nouns (der/die/das, le/la, …) so the word is
    // learnt with its gender (BRU-31). Null for non-nouns / article-less langs.
    article: text("article"),
    firstSeenMessageId: uuid("first_seen_message_id").references(
      () => messages.id,
      {
        onDelete: "set null",
      },
    ),
    mastery: integer("mastery").notNull().default(0),
    starred: boolean("starred").notNull().default(false),
    // Spaced-repetition scheduling (BRU-30). srsBox = Leitner box 1..6; dueAt =
    // when next due (null = new / not yet introduced); lastReviewedAt = last review.
    srsBox: integer("srs_box").notNull().default(1),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
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
