import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordUsage,
  __setRateCardCache,
  lookupRateCard,
} from "./cost-recording";
import type { Database } from "../db";

type FakeDb = Partial<Database> & { execute: ReturnType<typeof vi.fn> };

beforeEach(() => __setRateCardCache(new Map()));

describe("lookupRateCard", () => {
  it("finds the active card for a provider/operation/unitType pair", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "rc-1",
          provider: "openai",
          operation: "chat",
          unit_type: "input_tokens",
          price_per_unit: "0.00000015",
          effective_from: new Date("2026-01-01"),
          effective_to: null,
        },
      ]),
    } as unknown as FakeDb;
    const card = await lookupRateCard(db as unknown as Database, {
      provider: "openai",
      operation: "chat",
      unitType: "input_tokens",
      at: new Date("2026-05-27"),
    });
    expect(card?.id).toBe("rc-1");
    expect(card?.pricePerUnit).toBe("0.00000015");
  });

  it("returns null when no card matches", async () => {
    const db = { execute: vi.fn().mockResolvedValue([]) } as unknown as FakeDb;
    const card = await lookupRateCard(db as unknown as Database, {
      provider: "openai",
      operation: "fictional",
      unitType: "input_tokens",
      at: new Date(),
    });
    expect(card).toBeNull();
  });

  it("does not cache negative results — re-queries on the next call", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as FakeDb;
    await lookupRateCard(db as unknown as Database, {
      provider: "openai",
      operation: "missing",
      unitType: "input_tokens",
      at: new Date(),
    });
    await lookupRateCard(db as unknown as Database, {
      provider: "openai",
      operation: "missing",
      unitType: "input_tokens",
      at: new Date(),
    });
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});

describe("recordUsage", () => {
  it("inserts a usage_events row with computed cost_usd", async () => {
    const db = {
      execute: vi
        .fn()
        // first call: rate card lookup
        .mockResolvedValueOnce([
          {
            id: "rc-1",
            provider: "openai",
            operation: "chat",
            unit_type: "input_tokens",
            price_per_unit: "0.00000015",
            effective_from: new Date("2026-01-01"),
            effective_to: null,
          },
        ])
        // second call: insert
        .mockResolvedValueOnce([]),
    } as unknown as FakeDb;

    await recordUsage(db as unknown as Database, {
      userId: "user-1",
      platform: "ios",
      provider: "openai",
      operation: "chat",
      units: 1000,
      unitType: "input_tokens",
    });

    expect(db.execute).toHaveBeenCalledTimes(2);
    const insertCall = db.execute.mock.calls[1]?.[0] as {
      queryChunks: Array<{ value?: string[] } | unknown>;
    };
    // Drizzle SQL objects expose interleaved static-string chunks and param
    // values via `queryChunks`. Flatten to a single inspectable string so we
    // can verify both the target table and the computed cost ended up in the
    // query.
    const sqlText = insertCall.queryChunks
      .map((c) => {
        if (c && typeof c === "object" && "value" in c) {
          return (c as { value: string[] }).value.join("");
        }
        return String(c);
      })
      .join("|");
    expect(sqlText).toContain("usage_events");
    // 1000 * 0.00000015 = 0.00015
    expect(sqlText).toMatch(/0\.00015/);
  });

  it("does not throw when DB insert rejects (fire-and-forget)", async () => {
    const db = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: "rc-1",
            provider: "openai",
            operation: "chat",
            unit_type: "input_tokens",
            price_per_unit: "0.001",
            effective_from: new Date(),
            effective_to: null,
          },
        ])
        .mockRejectedValueOnce(new Error("postgres down")),
    } as unknown as FakeDb;

    await expect(
      recordUsage(db as unknown as Database, {
        userId: null,
        platform: "server",
        provider: "openai",
        operation: "chat",
        units: 1,
        unitType: "input_tokens",
      }),
    ).resolves.toBeUndefined();
  });

  it("skips insert and warns when no rate card matches", async () => {
    const db = {
      execute: vi.fn().mockResolvedValueOnce([]),
    } as unknown as FakeDb;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordUsage(db as unknown as Database, {
      userId: null,
      platform: "server",
      provider: "openai",
      operation: "unknown-op",
      units: 1,
      unitType: "input_tokens",
    });
    expect(db.execute).toHaveBeenCalledTimes(1); // only lookup, no insert
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
