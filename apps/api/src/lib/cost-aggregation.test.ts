import { describe, expect, it, vi } from "vitest";
import {
  getOverview,
  getByService,
  prorateFixedCost,
  amortizeUpfrontCost,
  type Filters,
} from "./cost-aggregation";
import type { Database } from "../db";

const baseFilters: Filters = {
  from: new Date("2026-05-01T00:00:00Z"),
  to: new Date("2026-05-31T23:59:59Z"),
};

describe("prorateFixedCost", () => {
  it("returns full amount for a monthly cost across an exact month", () => {
    const amount = prorateFixedCost({
      amountUsd: 5,
      period: "monthly",
      startedOn: new Date("2026-05-01"),
      endedOn: null,
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-06-01"),
    });
    expect(amount).toBeCloseTo(5, 2);
  });

  it("pro-rates a monthly cost for a 10-day window", () => {
    const amount = prorateFixedCost({
      amountUsd: 30,
      period: "monthly",
      startedOn: new Date("2026-01-01"),
      endedOn: null,
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-05-11"),
    });
    // 30 * 10 / 30 = 10
    expect(amount).toBeCloseTo(10, 2);
  });

  it("respects ended_on cutoff", () => {
    const amount = prorateFixedCost({
      amountUsd: 30,
      period: "monthly",
      startedOn: new Date("2026-01-01"),
      endedOn: new Date("2026-05-05"),
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-06-01"),
    });
    // 5 days inside window before service ended: 30 * 5/30 = 5
    expect(amount).toBeCloseTo(5, 2);
  });
});

describe("amortizeUpfrontCost", () => {
  it("with null amortize_months, returns full amount when paidOn is in window", () => {
    const amount = amortizeUpfrontCost({
      amountUsd: 25,
      paidOn: new Date("2026-05-15"),
      amortizeMonths: null,
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-06-01"),
    });
    expect(amount).toBe(25);
  });

  it("with null amortize_months, returns 0 when paidOn is outside window", () => {
    const amount = amortizeUpfrontCost({
      amountUsd: 25,
      paidOn: new Date("2026-04-15"),
      amortizeMonths: null,
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-06-01"),
    });
    expect(amount).toBe(0);
  });

  it("with amortize_months=12, spreads evenly across the window", () => {
    const amount = amortizeUpfrontCost({
      amountUsd: 99,
      paidOn: new Date("2026-01-15"),
      amortizeMonths: 12,
      windowFrom: new Date("2026-05-01"),
      windowTo: new Date("2026-06-01"),
    });
    // $99/year ≈ $8.25/month; window is 1 month
    expect(amount).toBeCloseTo(99 / 12, 2);
  });
});

describe("getOverview", () => {
  it("returns variable + infra + total + active users", async () => {
    const db = {
      execute: vi
        .fn()
        // variable cost query
        .mockResolvedValueOnce([
          { variable_cost: "12.50", active_users: 3, event_count: 42 },
        ])
        // fixed costs query
        .mockResolvedValueOnce([
          {
            id: "fc-1",
            service: "fly",
            amount_usd: "5",
            period: "monthly",
            started_on: "2026-01-01",
            ended_on: null,
          },
        ])
        // upfront costs query
        .mockResolvedValueOnce([
          {
            id: "uc-1",
            amount_usd: "99",
            paid_on: "2026-01-15",
            amortize_months: 12,
          },
        ]),
    } as unknown as Database;

    const result = await getOverview(db, baseFilters);
    expect(result.variableCostUsd).toBeCloseTo(12.5, 2);
    expect(result.activeUsers).toBe(3);
    expect(result.fixedCostUsd).toBeGreaterThan(0);
    expect(result.upfrontCostUsd).toBeGreaterThan(0);
    expect(result.totalCostUsd).toBeCloseTo(
      result.variableCostUsd + result.fixedCostUsd + result.upfrontCostUsd,
      2,
    );
  });
});

describe("getByService", () => {
  it("returns variable cost rows ordered by cost desc", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        { service: "openai", cost: "10.00", units: "1000", event_count: 30 },
        { service: "deepgram", cost: "2.50", units: "200", event_count: 12 },
      ]),
    } as unknown as Database;
    const rows = await getByService(db, baseFilters);
    expect(rows[0]!.service).toBe("openai");
    expect(rows[0]!.costUsd).toBeCloseTo(10, 2);
  });
});

describe("filters: hidden when userId set", () => {
  it("getOverview does NOT include fixed/upfront when userId filter is set", async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          { variable_cost: "1.00", active_users: 1, event_count: 5 },
        ]),
    } as unknown as Database;
    const out = await getOverview(db, { ...baseFilters, userId: "u-1" });
    expect(out.fixedCostUsd).toBe(0);
    expect(out.upfrontCostUsd).toBe(0);
    // only one query executed (variable), no fixed/upfront lookups
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
