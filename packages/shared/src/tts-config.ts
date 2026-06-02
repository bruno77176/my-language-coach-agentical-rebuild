export type TtsProvider = "openai" | "elevenlabs";
export type TtsStyle = "warm" | "cheerful" | "calm" | "serious" | "energetic";

export type TtsConfig = {
  provider: TtsProvider;
  voiceId: string;
  speed: number; // 0.8–1.2 in the UI; backend clamps per provider
  style: TtsStyle;
};

export const TTS_STYLES: TtsStyle[] = [
  "warm",
  "cheerful",
  "calm",
  "serious",
  "energetic",
];

// No override == this == current production behavior.
export const DEFAULT_TTS_CONFIG: TtsConfig = {
  provider: "openai",
  voiceId: "nova",
  speed: 1.0,
  style: "warm",
};

// Curated lists for the Lab pickers (not the full provider catalogs).
export const OPENAI_TTS_VOICES = [
  "nova",
  "shimmer",
  "sage",
  "coral",
  "alloy",
  "echo",
  "ash",
  "ballad",
  "verse",
] as const;

export const ELEVENLABS_TTS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
] as const;

export const TTS_SPEED_OPTIONS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;
