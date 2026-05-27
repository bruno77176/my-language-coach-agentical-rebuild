import { pgTable, uuid, text, numeric, date } from "drizzle-orm/pg-core";

export const fixedCosts = pgTable("fixed_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: text("service").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  period: text("period").notNull(), // 'monthly' | 'yearly'
  startedOn: date("started_on").notNull(),
  endedOn: date("ended_on"),
  notes: text("notes"),
});

export type FixedCost = typeof fixedCosts.$inferSelect;
export type NewFixedCost = typeof fixedCosts.$inferInsert;
