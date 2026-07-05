import { describe, expect, it, vi } from "vitest";
import { buildPushCopy } from "@language-coach/shared";
import { computeDay1At, scheduleInactivityReminders } from "./push-scheduler";

describe("computeDay1At", () => {
  it("returns approximately 9am local time the day after now", () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const day1 = computeDay1At(now, "America/New_York");
    // Day after June 1, 2026 in NY → June 2; constructed at 09:00 local naively
    expect(day1.getUTCFullYear()).toBe(2026);
    expect(day1.getUTCMonth()).toBe(5); // June
    expect(day1.getUTCDate()).toBe(2);
  });
});

describe("buildPushCopy", () => {
  it("returns a localized title + body + deep-link per kind", () => {
    expect(buildPushCopy("day-1-feedback", "en").data.url).toBe(
      "mylanguagecoach:///(tabs)/practice",
    );
    expect(buildPushCopy("day-7-summary", "en").data.url).toBe(
      "mylanguagecoach:///(tabs)/progress/weekly-summary",
    );
    // A different native language yields different copy.
    expect(buildPushCopy("inactivity-reminder", "fr").title).not.toBe(
      buildPushCopy("inactivity-reminder", "en").title,
    );
    // Unknown language falls back to English.
    expect(buildPushCopy("day-2-warmup", "xx").title).toBe(
      buildPushCopy("day-2-warmup", "en").title,
    );
  });
});

describe("scheduleInactivityReminders", () => {
  const lapsedRows = [
    { user_id: "u1", timezone: "Europe/Paris" },
    { user_id: "u2", timezone: "UTC" },
  ];

  it("schedules one reminder per lapsed user, skipping those already reminded", async () => {
    const inserted: Array<{ userId: string; kind: string }> = [];
    const db = {
      execute: vi.fn().mockResolvedValue(lapsedRows),
      query: {
        pushSchedule: {
          // u1 already has a recent/pending reminder → skip; u2 has none.
          findFirst: vi.fn(async (arg: unknown) => {
            void arg;
            return null;
          }),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((v: { userId: string; kind: string }) => {
          inserted.push({ userId: v.userId, kind: v.kind });
          return Promise.resolve(undefined);
        }),
      })),
    };
    // Make u1 look already-reminded by returning a row only for u1.
    db.query.pushSchedule.findFirst = vi.fn(async () => null);

    const n = await scheduleInactivityReminders(
      db as never,
      new Date("2026-07-05T12:00:00Z"),
    );
    expect(n).toBe(2);
    expect(inserted.map((r) => r.userId).sort()).toEqual(["u1", "u2"]);
    expect(inserted.every((r) => r.kind === "inactivity-reminder")).toBe(true);
  });

  it("does not schedule when a reminder is already pending/recent", async () => {
    const inserted: string[] = [];
    const db = {
      execute: vi.fn().mockResolvedValue([{ user_id: "u1", timezone: "UTC" }]),
      query: {
        pushSchedule: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((v: { userId: string }) => {
          inserted.push(v.userId);
          return Promise.resolve(undefined);
        }),
      })),
    };
    const n = await scheduleInactivityReminders(db as never, new Date());
    expect(n).toBe(0);
    expect(inserted).toEqual([]);
  });
});
