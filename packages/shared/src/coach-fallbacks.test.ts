import { describe, expect, it } from "vitest";
import {
  COACH_FALLBACKS,
  getCoachFallback,
  type SoftErrorCode,
} from "./coach-fallbacks";
import { SUPPORTED_LANG_CODES } from "./languages";

const ALL_CODES: SoftErrorCode[] = [
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
];

describe("COACH_FALLBACKS", () => {
  it("covers every supported language and every soft code", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      for (const code of ALL_CODES) {
        expect(COACH_FALLBACKS[lang]?.[code]).toBeTruthy();
      }
    }
  });
});

describe("getCoachFallback", () => {
  it("returns the right English string for AUDIO_SILENT", () => {
    expect(getCoachFallback("en", "AUDIO_SILENT")).toBe(
      "Hmm, I didn't catch that — could you try again?",
    );
  });

  it("falls back to English when language is unknown", () => {
    // @ts-expect-error testing unknown lang
    const out = getCoachFallback("xx", "AUDIO_SILENT");
    expect(out).toBe("Hmm, I didn't catch that — could you try again?");
  });
});
