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
import { synthesizeSpeechGemini } from "./gemini";
import { synthesizeSpeechInworld } from "./inworld";
import type { OnUsage } from "./usage";

export type RoutedTtsInput = {
  text: string;
  languageCode?: string;
  config?: TtsConfig;
  onUsage?: OnUsage;
};

export type TtsDeps = {
  openai: OpenAI;
  eleven: ElevenLabsClient;
  geminiKey?: string;
  inworldKey?: string;
  // Injected so tests can stub providers; production uses the real fns.
  synth?: {
    openai?: (c: OpenAI, i: TtsInput) => Promise<TtsResult>;
    eleven?: (c: ElevenLabsClient, i: SynthesizeInput) => Promise<TtsResult>;
    gemini?: (
      key: string | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
    inworld?: (
      key: string | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
  };
};

export function makeSynthesizeSpeech(deps: TtsDeps) {
  const openAiSynth = deps.synth?.openai ?? synthesizeSpeechOpenAI;
  const elevenSynth = deps.synth?.eleven ?? synthesizeSpeechElevenLabs;
  const geminiSynth = deps.synth?.gemini ?? synthesizeSpeechGemini;
  const inworldSynth = deps.synth?.inworld ?? synthesizeSpeechInworld;

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
    switch (config.provider) {
      case "elevenlabs":
        return elevenSynth(deps.eleven, shared);
      case "gemini":
        return geminiSynth(deps.geminiKey, shared);
      case "inworld":
        return inworldSynth(deps.inworldKey, shared);
      default:
        return openAiSynth(deps.openai, shared);
    }
  };
}
