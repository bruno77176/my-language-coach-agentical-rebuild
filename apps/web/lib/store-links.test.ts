import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStoreLinks,
  DEFAULT_IOS_URL,
  DEFAULT_ANDROID_URL,
} from "./store-links";

describe("getStoreLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when env vars are unset", () => {
    vi.stubEnv("NEXT_PUBLIC_IOS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_ANDROID_URL", "");
    const links = getStoreLinks();
    expect(links.ios).toBe(DEFAULT_IOS_URL);
    expect(links.android).toBe(DEFAULT_ANDROID_URL);
  });

  it("uses env vars when set", () => {
    vi.stubEnv("NEXT_PUBLIC_IOS_URL", "https://example.com/ios");
    vi.stubEnv("NEXT_PUBLIC_ANDROID_URL", "https://example.com/android");
    const links = getStoreLinks();
    expect(links.ios).toBe("https://example.com/ios");
    expect(links.android).toBe("https://example.com/android");
  });

  it("exports defaults that look like real store URLs", () => {
    expect(DEFAULT_IOS_URL).toMatch(/^https:\/\/apps\.apple\.com\/app\/id/);
    expect(DEFAULT_ANDROID_URL).toMatch(
      /^https:\/\/play\.google\.com\/store\/apps\/details\?id=/,
    );
  });
});
