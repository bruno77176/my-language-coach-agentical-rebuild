export type TtsProvider = "openai" | "elevenlabs" | "gemini" | "inworld";
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

// The default coach voice for everyone. Gemini "Kore" with a warm tone —
// requires Gemini Cloud billing on the key's project (free-tier quota is tiny).
export const DEFAULT_TTS_CONFIG: TtsConfig = {
  provider: "gemini",
  voiceId: "Kore",
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

// Gemini prebuilt voices are language-agnostic — the model speaks whatever
// language is requested. id === name (Gemini takes the voice name directly).
export const GEMINI_TTS_VOICES = [
  { id: "Kore", name: "Kore" },
  { id: "Puck", name: "Puck" },
  { id: "Charon", name: "Charon" },
  { id: "Aoede", name: "Aoede" },
  { id: "Leda", name: "Leda" },
  { id: "Orus", name: "Orus" },
] as const;

// NOTE: verify these voice IDs against Inworld's voice-list endpoint during
// Task 5 and adjust here if the API rejects any. Names double as IDs.
export const INWORLD_TTS_VOICES = [
  { id: "Ashley", name: "Ashley" },
  { id: "Olivia", name: "Olivia" },
  { id: "Mark", name: "Mark" },
  { id: "Hades", name: "Hades" },
  { id: "Sarah", name: "Sarah" },
] as const;
