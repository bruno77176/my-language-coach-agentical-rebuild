import { describe, it, expect } from "vitest";
import { DEFAULT_TTS_CONFIG } from "@language-coach/shared";
import { voiceConfigForLanguage } from "./voice-map";

describe("voiceConfigForLanguage", () => {
  it("returns the native German voice for 'de'", () => {
    expect(voiceConfigForLanguage("de")).toMatchObject({
      provider: "elevenlabs",
      voiceId: "7eVMgwCnXydb3CikjV7a",
    });
  });

  it("returns the native Spanish voice for 'es'", () => {
    expect(voiceConfigForLanguage("es")).toMatchObject({
      provider: "elevenlabs",
      voiceId: "Ir1QNHvhaJXbAGhT50w3",
    });
  });

  it("returns the native French voice for 'fr'", () => {
    expect(voiceConfigForLanguage("fr")).toMatchObject({
      provider: "elevenlabs",
      voiceId: "ucMmKRQbfDEYyb2IIGax",
    });
  });

  it("returns the native Italian voice for 'it'", () => {
    expect(voiceConfigForLanguage("it")).toMatchObject({
      provider: "elevenlabs",
      voiceId: "kAzI34nYjizE0zON6rXv",
    });
  });

  it("falls back to the default voice for a language with no native voice", () => {
    // Japanese has no dedicated native voice yet.
    expect(voiceConfigForLanguage("ja")).toEqual(DEFAULT_TTS_CONFIG);
  });

  it("falls back to the default voice when languageCode is undefined", () => {
    expect(voiceConfigForLanguage(undefined)).toEqual(DEFAULT_TTS_CONFIG);
  });
});
