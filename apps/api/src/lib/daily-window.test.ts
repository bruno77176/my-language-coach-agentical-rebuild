import { describe, expect, it } from "vitest";
import { localDayKey, nextLocalMidnightUtc } from "./daily-window";

describe("localDayKey", () => {
  it("returns the local calendar date in the given tz (UTC+1, Zurich winter)", () => {
    // 2026-01-15 10:00Z → 11:00 local in Zurich → same day
    expect(localDayKey(new Date("2026-01-15T10:00:00Z"), "Europe/Zurich")).toBe(
      "2026-01-15",
    );
  });

  it("rolls to the next local day for a late-UTC instant (Tokyo UTC+9)", () => {
    // 2026-01-15 16:00Z → 01:00 next day in Tokyo
    expect(localDayKey(new Date("2026-01-15T16:00:00Z"), "Asia/Tokyo")).toBe(
      "2026-01-16",
    );
  });

  it("rolls back a day near midnight (Zurich just before local midnight)", () => {
    // 2026-01-15 22:30Z → 23:30 local Zurich (still the 15th)
    expect(localDayKey(new Date("2026-01-15T22:30:00Z"), "Europe/Zurich")).toBe(
      "2026-01-15",
    );
  });
});

describe("nextLocalMidnightUtc", () => {
  it("Zurich winter (UTC+1): next midnight is 23:00Z", () => {
    expect(
      nextLocalMidnightUtc(
        new Date("2026-01-15T10:00:00Z"),
        "Europe/Zurich",
      ).toISOString(),
    ).toBe("2026-01-15T23:00:00.000Z");
  });

  it("Zurich summer (UTC+2, DST): next midnight is 22:00Z", () => {
    expect(
      nextLocalMidnightUtc(
        new Date("2026-07-01T10:00:00Z"),
        "Europe/Zurich",
      ).toISOString(),
    ).toBe("2026-07-01T22:00:00.000Z");
  });

  it("Tokyo (UTC+9, no DST): next midnight is 15:00Z the prior day", () => {
    expect(
      nextLocalMidnightUtc(
        new Date("2026-01-15T10:00:00Z"),
        "Asia/Tokyo",
      ).toISOString(),
    ).toBe("2026-01-15T15:00:00.000Z");
  });

  it("handles a near-midnight instant (already past local midnight rolls to the following day)", () => {
    // 2026-01-15 23:30Z → 00:30 local on the 16th in Zurich → next midnight = 17th 00:00 local = 16th 23:00Z
    expect(
      nextLocalMidnightUtc(
        new Date("2026-01-15T23:30:00Z"),
        "Europe/Zurich",
      ).toISOString(),
    ).toBe("2026-01-16T23:00:00.000Z");
  });
});
