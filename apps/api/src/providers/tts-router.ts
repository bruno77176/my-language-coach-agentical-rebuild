import type OpenAI from "openai";
import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { type TtsConfig } from "@language-coach/shared";
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
import { voiceConfigForLanguage } from "./voice-map";
import type { AccessTokenProvider } from "../lib/google-tts-auth";
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
  // GA Cloud TTS (Gemini) authenticates with an OAuth2 access token from a
  // service account, not an API key.
  geminiAuth?: AccessTokenProvider;
  inworldKey?: string;
  // Injected so tests can stub providers; production uses the real fns.
  synth?: {
    openai?: (c: OpenAI, i: TtsInput) => Promise<TtsResult>;
    eleven?: (c: ElevenLabsClient, i: SynthesizeInput) => Promise<TtsResult>;
    gemini?: (
      auth: AccessTokenProvider | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
    inworld?: (
      key: string | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
  };
};

// Reliable OpenAI voice used when the requested provider fails. OpenAI is our
// most dependable provider and its voiceIds differ from Gemini/ElevenLabs/
// Inworld, so we can't reuse the requested voiceId on the fallback path.
const FALLBACK_VOICE_ID = "nova";

export function makeSynthesizeSpeech(deps: TtsDeps) {
  const openAiSynth = deps.synth?.openai ?? synthesizeSpeechOpenAI;
  const elevenSynth = deps.synth?.eleven ?? synthesizeSpeechElevenLabs;
  const geminiSynth = deps.synth?.gemini ?? synthesizeSpeechGemini;
  const inworldSynth = deps.synth?.inworld ?? synthesizeSpeechInworld;

  return async (input: RoutedTtsInput): Promise<TtsResult> => {
    // Priority: an explicit per-user voice config wins; otherwise pick the
    // per-language native voice (which itself falls back to DEFAULT_TTS_CONFIG
    // for languages without a dedicated voice).
    const config = input.config ?? voiceConfigForLanguage(input.languageCode);
    const shared = {
      text: input.text,
      voiceId: config.voiceId,
      languageCode: input.languageCode,
      speed: config.speed,
      style: config.style,
      onUsage: input.onUsage,
    };
    try {
      switch (config.provider) {
        case "elevenlabs":
          return await elevenSynth(deps.eleven, shared);
        case "gemini":
          return await geminiSynth(deps.geminiAuth, shared);
        case "inworld":
          return await inworldSynth(deps.inworldKey, shared);
        default:
          return await openAiSynth(deps.openai, shared);
      }
    } catch (err) {
      // A non-OpenAI provider failed (rate limit, outage, bad response). Degrade
      // to OpenAI's reliable default voice so the user still gets audio instead
      // of a "TTS failed" message. If OpenAI itself was the request, propagate.
      if (config.provider === "openai") throw err;
      console.warn(
        `[tts] provider "${config.provider}" failed (${(err as Error).message}); ` +
          `falling back to OpenAI "${FALLBACK_VOICE_ID}"`,
      );
      return openAiSynth(deps.openai, {
        ...shared,
        voiceId: FALLBACK_VOICE_ID,
      });
    }
  };
}
