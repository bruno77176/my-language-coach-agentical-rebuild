import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// A user's "liked" daily quotes (BRU-9). quoteId is the stable kebab-case id
// from the shared DAILY_QUOTES list. Composite PK keeps likes unique per user.
export const quoteLikes = pgTable(
  "quote_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    quoteId: text("quote_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.quoteId] }),
  }),
);

export type QuoteLike = typeof quoteLikes.$inferSelect;
