import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";

// One TTS voice per target language.
//
// All entries use ElevenLabs (model `eleven_flash_v2_5`, which is multilingual
// and pins pronunciation via the `languageCode` we already pass to the provider).
// The lever here is the **voice ID** — pick a voice recorded by a NATIVE speaker
// of the language for a natural accent. English-recorded voices speaking e.g.
// German carry an English accent even with the language pinned.
//
// To add a language: in ElevenLabs → Voices (or the Voice Library, filter by the
// target language) → open the voice → copy its Voice ID → add a line below.
// Available voices in the account + how to find IDs: docs/voice-per-language.md.
//
// Languages NOT listed here fall back to DEFAULT_TTS_CONFIG. Today only de/es/en
// have native voices in the account; the other supported languages still need a
// native voice added to the ElevenLabs account before they can be wired here.
const el = (voiceId: string): TtsConfig => ({
  provider: "elevenlabs",
  voiceId,
  speed: 1.0,
  style: "warm",
});

// Gemini GA Cloud TTS. Its prebuilt voices (Kore, …) are multilingual — the
// model speaks whatever language we pin via languageCode, in a NATIVE accent.
// Used for languages with no native ElevenLabs voice in the account, so they
// stop falling back to the English-accented default "Sarah" (audit §5 AI-2).
// Gemini is a non-streaming REST call that can occasionally exceed its timeout;
// when it does, the TTS router falls back to OpenAI (still intelligible), so
// these never go silent — they just lose the native accent on that chunk.
const gem = (voiceId = "Kore"): TtsConfig => ({
  provider: "gemini",
  voiceId,
  speed: 1.0,
  style: "warm",
});

const VOICE_BY_LANGUAGE: Record<string, TtsConfig> = {
  // Native ElevenLabs voices (recorded by native speakers).
  en: el("EXAVITQu4vr4xnSDxMaL"), // Sarah — native English (American)
  de: el("7eVMgwCnXydb3CikjV7a"), // Lea - Clear and Feminine — native German
  es: el("Ir1QNHvhaJXbAGhT50w3"), // Sara Martin — native Spanish (peninsular)
  fr: el("ucMmKRQbfDEYyb2IIGax"), // Aurore — native French (parisian)
  it: el("kAzI34nYjizE0zON6rXv"), // Sami — native Italian
  // Native-accent Gemini TTS for the rest — previously English-accented Sarah.
  // CJK especially (Sarah speaking Japanese/Chinese/Korean is unusable).
  ja: gem(),
  zh: gem(),
  ko: gem(),
  ru: gem(),
  tr: gem(),
  pt: gem(),
  sv: gem(),
  da: gem(),
  ro: gem(),
  hu: gem(),
};

// Resolve the TTS voice for a target language. Falls back to the global default
// when the language has no dedicated native voice yet (so unknown/unconfigured
// languages still produce audio rather than erroring).
export function voiceConfigForLanguage(
  languageCode: string | undefined,
): TtsConfig {
  if (!languageCode) return DEFAULT_TTS_CONFIG;
  return VOICE_BY_LANGUAGE[languageCode] ?? DEFAULT_TTS_CONFIG;
}
