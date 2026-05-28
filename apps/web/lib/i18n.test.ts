import { describe, expect, it } from "vitest";
import { getMessages, localizedPath, type Locale } from "./i18n";
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

describe("locale message shape", () => {
  it("fr has every key en has", () => {
    const enKeys = collectKeys(en);
    const frKeys = collectKeys(fr);
    const missing = enKeys.filter((k) => !frKeys.includes(k));
    expect(missing, `Missing FR keys: ${missing.join(", ")}`).toEqual([]);
  });
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
