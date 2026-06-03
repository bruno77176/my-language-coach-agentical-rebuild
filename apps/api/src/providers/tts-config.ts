import { z } from "zod";
import {
  DEFAULT_TTS_CONFIG,
  TTS_STYLES,
  type TtsConfig,
  type TtsStyle,
} from "@language-coach/shared";

export const TtsConfigSchema = z.object({
  provider: z.enum(["openai", "elevenlabs", "gemini", "inworld"]),
  voiceId: z.string().min(1).max(64),
  speed: z.number().min(0.5).max(2.0),
  style: z.enum(TTS_STYLES as [TtsStyle, ...TtsStyle[]]),
});

/** Validate untrusted config (e.g. from the request); junk → default. */
export function parseTtsConfig(raw: unknown): TtsConfig {
  const parsed = TtsConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_TTS_CONFIG;
}

const OPENAI_STYLE: Record<TtsStyle, string> = {
  warm: "a warm, friendly, encouraging tone",
  cheerful: "a bright, cheerful, upbeat tone",
  calm: "a calm, soothing, measured tone",
  serious: "a clear, composed, neutral tone",
  energetic: "a lively, energetic, enthusiastic tone",
};
export function openAiStylePhrase(style: TtsStyle): string {
  return OPENAI_STYLE[style];
}

/** Map a numeric speed to instruction wording (works regardless of whether
 *  the model honors the native `speed` param). */
export function pacePhrase(speed: number): string {
  if (speed <= 0.9) return "a measured, slightly slow pace";
  if (speed >= 1.1) return "a lively, brisk pace";
  return "a natural, conversational pace";
}

const ELEVENLABS_STYLE: Record<TtsStyle, { stability: number; style: number }> =
  {
    warm: { stability: 0.5, style: 0.3 },
    cheerful: { stability: 0.4, style: 0.55 },
    calm: { stability: 0.7, style: 0.15 },
    serious: { stability: 0.75, style: 0.1 },
    energetic: { stability: 0.35, style: 0.7 },
  };
export function elevenLabsStyleSettings(style: TtsStyle): {
  stability: number;
  style: number;
} {
  return ELEVENLABS_STYLE[style];
}
