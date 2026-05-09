import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

export const messageRole = pgEnum("message_role", ["user", "coach"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    text: text("text").notNull(),
    translation: text("translation"),
    audioStoragePath: text("audio_storage_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    convCreatedIdx: index("messages_conv_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
