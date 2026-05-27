import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  integer,
} from "drizzle-orm/pg-core";

export const upfrontCosts = pgTable("upfront_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  paidOn: date("paid_on").notNull(),
  amortizeMonths: integer("amortize_months"),
  notes: text("notes"),
});

export type UpfrontCost = typeof upfrontCosts.$inferSelect;
export type NewUpfrontCost = typeof upfrontCosts.$inferInsert;
