import type { TtsProvider } from "@language-coach/shared";

export const PROVIDER_LABELS: Record<TtsProvider, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  gemini: "Gemini",
  inworld: "Inworld",
};

// User-facing taglines — no business metrics.
export const PROVIDER_TAGLINES: Record<TtsProvider, string> = {
  openai: "Natural & expressive",
  elevenlabs: "Ultra-realistic",
  gemini: "Crisp & lifelike",
  inworld: "Warm & conversational",
};

// Keyed by voiceId. Missing entries simply render no caption.
export const VOICE_DESCRIPTORS: Record<string, string> = {
  // OpenAI
  nova: "Bright & friendly",
  shimmer: "Soft & warm",
  sage: "Calm & wise",
  coral: "Lively & cheerful",
  alloy: "Neutral & clear",
  echo: "Smooth & mellow",
  ash: "Steady & grounded",
  ballad: "Gentle & lyrical",
  verse: "Versatile & dynamic",
  // ElevenLabs (keyed by voice id)
  EXAVITQu4vr4xnSDxMaL: "Warm & natural", // Sarah
  XB0fDUnXU5powFXDhCwa: "Soft & soothing", // Charlotte
  "21m00Tcm4TlvDq8ikWAM": "Clear & professional", // Rachel
  JBFqnCBsd6RMkjVDRZzb: "Deep & steady", // George
  pFZP5JQG7iQjIQuC4Bku: "Bright & youthful", // Lily
  // Gemini
  Kore: "Firm & confident",
  Puck: "Upbeat & playful",
  Charon: "Informative & even",
  Aoede: "Breezy & light",
  Leda: "Youthful & bright",
  Orus: "Low & grounded",
  // Inworld
  Ashley: "Warm & friendly",
  Olivia: "Soft & clear",
  Mark: "Steady & calm",
  Hades: "Deep & dramatic",
};
