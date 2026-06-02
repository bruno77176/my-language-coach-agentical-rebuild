import { describe, it, expect } from "vitest";
import {
  parseTtsConfig,
  openAiStylePhrase,
  pacePhrase,
  elevenLabsStyleSettings,
} from "./tts-config";
import { DEFAULT_TTS_CONFIG } from "@language-coach/shared";

describe("parseTtsConfig", () => {
  it("returns a valid config unchanged", () => {
    const cfg = {
      provider: "elevenlabs",
      voiceId: "EXAVITQu4vr4xnSDxMaL",
      speed: 1.1,
      style: "cheerful",
    };
    expect(parseTtsConfig(cfg)).toEqual(cfg);
  });
  it("falls back to default on junk/missing/unknown", () => {
    expect(parseTtsConfig(undefined)).toEqual(DEFAULT_TTS_CONFIG);
    expect(parseTtsConfig({ provider: "google" })).toEqual(DEFAULT_TTS_CONFIG);
    expect(parseTtsConfig("not json")).toEqual(DEFAULT_TTS_CONFIG);
  });
});

describe("style + pace mappings", () => {
  it("maps every style for both providers", () => {
    for (const s of [
      "warm",
      "cheerful",
      "calm",
      "serious",
      "energetic",
    ] as const) {
      expect(openAiStylePhrase(s)).toMatch(/\w/);
      expect(elevenLabsStyleSettings(s)).toHaveProperty("stability");
    }
  });
  it("derives a pace phrase from speed", () => {
    expect(pacePhrase(0.8)).toMatch(/slow|measured/i);
    expect(pacePhrase(1.0)).toMatch(/natural/i);
    expect(pacePhrase(1.2)).toMatch(/brisk|lively|fast/i);
  });
});
