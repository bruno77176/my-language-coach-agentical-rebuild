import { pgTable, uuid, text, boolean, jsonb } from "drizzle-orm/pg-core";

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  slug: text("slug").notNull(),
  label: jsonb("label").$type<Record<string, string>>().notNull(),
  systemPromptAddendum: text("system_prompt_addendum").notNull(),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
});

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
