import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const rateCards = pgTable(
  "rate_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    unitType: text("unit_type").notNull(),
    pricePerUnit: numeric("price_per_unit", {
      precision: 18,
      scale: 10,
    }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => ({
    uniq: uniqueIndex("rate_cards_unique_idx").on(
      t.provider,
      t.operation,
      t.unitType,
      t.effectiveFrom,
    ),
  }),
);

export type RateCard = typeof rateCards.$inferSelect;
export type NewRateCard = typeof rateCards.$inferInsert;
