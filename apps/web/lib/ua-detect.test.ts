import { describe, expect, it } from "vitest";
import { detectPlatform, type Platform } from "./ua-detect";

const cases: Array<{ name: string; ua: string; expected: Platform }> = [
  {
    name: "iPhone Safari",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    expected: "ios",
  },
  {
    name: "iPad Safari",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    expected: "ios",
  },
  {
    name: "Android Chrome",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    expected: "android",
  },
  {
    name: "Desktop macOS Chrome",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    expected: "desktop",
  },
  {
    name: "Desktop Windows Firefox",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
    expected: "desktop",
  },
  {
    name: "Empty UA",
    ua: "",
    expected: "unknown",
  },
  {
    name: "Bot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    expected: "desktop",
  },
];

describe("detectPlatform", () => {
  for (const { name, ua, expected } of cases) {
    it(`detects ${name} as ${expected}`, () => {
      expect(detectPlatform(ua)).toBe(expected);
    });
  }

  it("returns 'unknown' when given null/undefined", () => {
    expect(detectPlatform(null)).toBe("unknown");
    expect(detectPlatform(undefined)).toBe("unknown");
  });
});
