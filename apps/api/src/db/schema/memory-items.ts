import {
  customType,
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { conversations } from "./conversations";

// DB vector(1536) <-> TS number[]. pgvector wants a "[1,2,3]" text literal.
export const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

export const memoryItems = pgTable("memory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
  salience: real("salience").notNull().default(0.5),
  status: text("status").notNull().default("active"),
  sourceConversationId: uuid("source_conversation_id").references(
    () => conversations.id,
    { onDelete: "set null" },
  ),
  dueAt: timestamp("due_at", { withTimezone: true }),
  srIntervalDays: integer("sr_interval_days"),
  srEase: real("sr_ease"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MemoryItemRow = typeof memoryItems.$inferSelect;
export type NewMemoryItemRow = typeof memoryItems.$inferInsert;
