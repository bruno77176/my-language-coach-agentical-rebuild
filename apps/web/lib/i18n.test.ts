import { describe, expect, it } from "vitest";
import {
  getMessages,
  isLocale,
  localizedPath,
  LOCALES,
  LOCALE_META,
  type Locale,
} from "./i18n";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

describe("getMessages", () => {
  it("returns en for 'en'", () => {
    expect(getMessages("en")).toEqual(en);
  });

  it("returns fr for 'fr'", () => {
    expect(getMessages("fr")).toEqual(fr);
  });

  it("falls back to en for unknown locale", () => {
    // @ts-expect-error: testing invalid input on purpose
    expect(getMessages("zz")).toEqual(en);
  });
});

describe("LOCALES registry", () => {
  it("has 15 locales", () => {
    expect(LOCALES).toHaveLength(15);
  });

  for (const locale of ["ja", "zh", "ko"] as const) {
    it(`includes ${locale}`, () => {
      expect(LOCALES).toContain(locale);
    });

    it(`${locale} has LOCALE_META`, () => {
      expect(LOCALE_META[locale]).toBeDefined();
      expect(LOCALE_META[locale].englishName).toBeTruthy();
      expect(LOCALE_META[locale].nativeName).toBeTruthy();
      expect(LOCALE_META[locale].flag).toBeTruthy();
    });

    it(`isLocale("${locale}") is true`, () => {
      expect(isLocale(locale)).toBe(true);
    });

    it(`getMessages("${locale}") resolves to a real catalog (not en fallback)`, () => {
      const messages = getMessages(locale);
      expect(messages).toBeDefined();
      // footer.switchLanguage links back to English for non-en locales.
      expect(messages.footer.switchLanguage).toBe("English");
    });
  }
});

describe("locale message shape", () => {
  // Every locale's catalog must carry the exact same set of keys as en.json.
  // dictionaries casts each catalog `as Messages`, so TypeScript will NOT
  // catch a missing/extra key — this test is the only guard.
  const enKeys = collectKeys(en).sort();

  for (const locale of LOCALES) {
    it(`${locale} has exactly the same keys as en`, () => {
      const localeKeys = collectKeys(getMessages(locale)).sort();
      const missing = enKeys.filter((k) => !localeKeys.includes(k));
      const extra = localeKeys.filter((k) => !enKeys.includes(k));
      expect(missing, `Missing ${locale} keys: ${missing.join(", ")}`).toEqual(
        [],
      );
      expect(extra, `Extra ${locale} keys: ${extra.join(", ")}`).toEqual([]);
    });
  }
});

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("localizedPath", () => {
  const cases: Array<[string, Locale, string]> = [
    ["/", "en", "/"],
    ["/", "fr", "/fr"],
    ["/fr", "en", "/"],
    ["/fr", "fr", "/fr"],
    ["/privacy", "en", "/privacy"],
    ["/privacy", "fr", "/fr/privacy"],
    ["/fr/privacy", "en", "/privacy"],
    ["/fr/privacy", "fr", "/fr/privacy"],
    ["/terms", "fr", "/fr/terms"],
  ];

  for (const [input, locale, expected] of cases) {
    it(`localizedPath(${input}, ${locale}) === ${expected}`, () => {
      expect(localizedPath(input, locale)).toBe(expected);
    });
  }
});
