import { describe, it, expect } from "vitest";
import {
  DEFAULT_TTS_CONFIG,
  TTS_STYLES,
  OPENAI_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  TTS_SPEED_OPTIONS,
} from "./tts-config";

describe("tts-config", () => {
  it("defaults everyone to the ElevenLabs Flash warm voice (Sarah)", () => {
    expect(DEFAULT_TTS_CONFIG).toEqual({
      provider: "elevenlabs",
      voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah
      speed: 1.0,
      style: "warm",
    });
  });
  it("exposes the five tone presets and speed/voice catalogs", () => {
    expect(TTS_STYLES).toEqual([
      "warm",
      "cheerful",
      "calm",
      "serious",
      "energetic",
    ]);
    expect(OPENAI_TTS_VOICES).toContain("nova");
    expect(ELEVENLABS_TTS_VOICES.every((v) => v.id && v.name)).toBe(true);
    expect(TTS_SPEED_OPTIONS).toContain(1.0);
  });
});
