// Mapping of target language -> ElevenLabs voice ID. We use the multilingual
// "Rachel" voice by default (handles all 12 supported languages reasonably).
// To customize per language, pick voice IDs from
// https://elevenlabs.io/app/voice-library?language=<code>.

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — multilingual

export function voiceIdForLanguage(_languageCode: string): string {
  // For v1, all languages use Rachel. Customize later.
  return DEFAULT_VOICE_ID;
}
