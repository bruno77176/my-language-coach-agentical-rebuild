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

const VOICE_BY_LANGUAGE: Record<string, TtsConfig> = {
  en: el("EXAVITQu4vr4xnSDxMaL"), // Sarah — native English (American)
  de: el("7eVMgwCnXydb3CikjV7a"), // Lea - Clear and Feminine — native German
  es: el("Ir1QNHvhaJXbAGhT50w3"), // Sara Martin — native Spanish (peninsular)
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
