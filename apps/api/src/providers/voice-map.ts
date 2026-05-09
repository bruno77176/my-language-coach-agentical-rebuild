// Mapping of target language -> TTS voice name.
//
// We use OpenAI TTS (not ElevenLabs) — ElevenLabs Creator subscription
// ($22/mo) is required to use library voices via API. Bruno is on free +
// pay-as-you-go credits which don't qualify. OpenAI TTS works on any paid
// OpenAI account and supports all 12 languages we ship via the same model.
//
// Available OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer.
// "nova" is a friendly female narrator that works well for a language coach.

const DEFAULT_VOICE = "nova";

export function voiceIdForLanguage(_languageCode: string): string {
  // For v1, all languages use the same voice. Customize later if specific
  // languages benefit from a different voice (e.g. deeper voice for German).
  return DEFAULT_VOICE;
}
