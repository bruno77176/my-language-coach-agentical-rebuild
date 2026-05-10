import { describe, expect, it } from "vitest";
import { DAILY_QUOTES, quoteForDay } from "./daily-quotes";
import { SUPPORTED_LANG_CODES } from "./languages";

describe("daily quotes catalog", () => {
  it("contains at least one quote", () => {
    expect(DAILY_QUOTES.length).toBeGreaterThan(0);
  });

  it("every quote has translations for every supported language", () => {
    for (const q of DAILY_QUOTES) {
      for (const lang of SUPPORTED_LANG_CODES) {
        expect(
          q.translations[lang],
          `quote ${q.id} missing translation for ${lang}`,
        ).toBeTruthy();
      }
    }
  });

  it("every quote has a non-empty original text and attribution", () => {
    for (const q of DAILY_QUOTES) {
      expect(q.original.text.trim()).not.toBe("");
      expect(q.attribution.trim()).not.toBe("");
      expect(q.original.lang.trim()).not.toBe("");
    }
  });

  it("quote IDs are unique", () => {
    const ids = DAILY_QUOTES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("quoteForDay", () => {
  it("returns the same quote for the same date+timezone", () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const a = quoteForDay(date, "Europe/Paris");
    const b = quoteForDay(date, "Europe/Paris");
    expect(a.id).toBe(b.id);
  });

  it("rolls over at midnight in the user's timezone", () => {
    // 2026-05-10 23:30 UTC = 2026-05-11 01:30 Paris (different day)
    const utc = new Date("2026-05-10T23:30:00Z");
    const a = quoteForDay(utc, "UTC"); // still May 10 UTC
    const b = quoteForDay(utc, "Europe/Paris"); // already May 11 in Paris
    if (DAILY_QUOTES.length > 1) {
      expect(a.id).not.toBe(b.id);
    }
  });

  it("is deterministic across years (cycles through the catalog)", () => {
    const a = quoteForDay(new Date("2026-05-10T12:00:00Z"), "UTC");
    const b = quoteForDay(new Date("2027-05-10T12:00:00Z"), "UTC");
    expect(a.id).toBe(b.id);
  });
});
