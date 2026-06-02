import type OpenAI from "openai";
import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";
import {
  synthesizeSpeechOpenAI,
  type TtsResult,
  type TtsInput,
} from "./openai";
import {
  synthesizeSpeech as synthesizeSpeechElevenLabs,
  type SynthesizeInput,
} from "./elevenlabs";
import type { OnUsage } from "./usage";

export type RoutedTtsInput = {
  text: string;
  languageCode?: string;
  config?: TtsConfig;
  onUsage?: OnUsage;
};

// The two `synth*` params are injected so tests can stub them; production
// passes the real provider functions.
export function makeSynthesizeSpeech(
  openai: OpenAI,
  eleven: ElevenLabsClient,
  openAiSynth: (
    c: OpenAI,
    i: TtsInput,
  ) => Promise<TtsResult> = synthesizeSpeechOpenAI,
  elevenSynth: (
    c: ElevenLabsClient,
    i: SynthesizeInput,
  ) => Promise<TtsResult> = synthesizeSpeechElevenLabs,
) {
  return async (input: RoutedTtsInput): Promise<TtsResult> => {
    const config = input.config ?? DEFAULT_TTS_CONFIG;
    const shared = {
      text: input.text,
      voiceId: config.voiceId,
      languageCode: input.languageCode,
      speed: config.speed,
      style: config.style,
      onUsage: input.onUsage,
    };
    if (config.provider === "elevenlabs") {
      return elevenSynth(eleven, shared);
    }
    return openAiSynth(openai, shared);
  };
}
