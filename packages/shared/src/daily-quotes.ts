import type { SupportedLang } from "./languages";

export type { SupportedLang } from "./languages";

export type DailyQuote = {
  /** Stable kebab-case id, e.g. "wittgenstein-grenzen". */
  id: string;
  /** The quote in its original language. lang may be ANY language code,
   *  including ones not in SupportedLang (e.g. "la" Latin, "iu" Inuktitut). */
  original: {
    lang: string;
    /** Display name of the original language, e.g. "German", "Latin". */
    langDisplayName: string;
    /** Flag emoji (or empty string if no clear flag). */
    flag: string;
    text: string;
  };
  /** "— Wittgenstein", "— Tao Te Ching", etc. */
  attribution: string;
  /** Pre-baked translations into all 12 supported languages. Required. */
  translations: Record<SupportedLang, string>;
};

export const DAILY_QUOTES: readonly DailyQuote[] = [
  // Populated in Task 5
];

/**
 * Compute 1-based day-of-year in the given IANA timezone.
 * Uses Intl to convert "now" to the local date, then counts days from Jan 1.
 */
export function dayOfYearInTimezone(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) =>
    parts.find((p) => p.type === t)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const startOfYearMs = Date.UTC(year, 0, 1);
  const localMs = Date.UTC(year, month - 1, day);
  return Math.floor((localMs - startOfYearMs) / (1000 * 60 * 60 * 24)) + 1;
}

/** Returns the quote for `date` in `timezone`. Deterministic. */
export function quoteForDay(date: Date, timezone: string): DailyQuote {
  if (DAILY_QUOTES.length === 0) {
    throw new Error("DAILY_QUOTES is empty — populate the catalog");
  }
  const dayIndex = (dayOfYearInTimezone(date, timezone) - 1) % DAILY_QUOTES.length;
  return DAILY_QUOTES[dayIndex];
}
