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

// Minimum plausible audio size. A provider can return HTTP 200 with an empty /
// truncated stream on a soft limit (ElevenLabs concurrency/quota) — real speech
// audio is far larger than this, so anything below it is treated as "no audio"
// and triggers the OpenAI fallback rather than shipping a silent message.
const MIN_TTS_BYTES = 256;

// The mobile Voice Lab always sends a config, defaulting to DEFAULT_TTS_CONFIG
// (one English voice). Treat a config equal to the default as "no explicit
// choice" so the per-language native voice wins — only a Voice Lab config the
// user actually changed counts as a real override.
function isDefaultTtsConfig(c: TtsConfig): boolean {
  return (
    c.provider === DEFAULT_TTS_CONFIG.provider &&
    c.voiceId === DEFAULT_TTS_CONFIG.voiceId &&
    c.speed === DEFAULT_TTS_CONFIG.speed &&
    c.style === DEFAULT_TTS_CONFIG.style
  );
}

/**
 * Resolve the effective voice config for a request: a user-CHANGED config wins;
 * a config equal to the default defers to the per-language native voice. This
 * is the single source of truth for "which voice will actually be spoken" — the
 * greeting route uses it so the greeting's voice (and its cache key) match the
 * voice the rest of the session's turns will use (BRU-19).
 */
export function resolveTtsConfig(input: {
  config?: TtsConfig;
  languageCode?: string;
}): TtsConfig {
  const explicit =
    input.config && !isDefaultTtsConfig(input.config)
      ? input.config
      : undefined;
  return explicit ?? voiceConfigForLanguage(input.languageCode);
}

export function makeSynthesizeSpeech(deps: TtsDeps) {
  const openAiSynth = deps.synth?.openai ?? synthesizeSpeechOpenAI;
  const elevenSynth = deps.synth?.eleven ?? synthesizeSpeechElevenLabs;
  const geminiSynth = deps.synth?.gemini ?? synthesizeSpeechGemini;
  const inworldSynth = deps.synth?.inworld ?? synthesizeSpeechInworld;

  return async (input: RoutedTtsInput): Promise<TtsResult> => {
    // Priority: a user-CHANGED voice config wins; a config equal to the default
    // is ignored so the per-language native voice is used instead (which itself
    // falls back to DEFAULT_TTS_CONFIG for languages with no dedicated voice).
    const config = resolveTtsConfig({
      config: input.config,
      languageCode: input.languageCode,
    });
    const shared = {
      text: input.text,
      voiceId: config.voiceId,
      languageCode: input.languageCode,
      speed: config.speed,
      style: config.style,
      onUsage: input.onUsage,
    };
    let result: TtsResult | undefined;
    let primaryErr: unknown;
    try {
      switch (config.provider) {
        case "elevenlabs":
          result = await elevenSynth(deps.eleven, shared);
          break;
        case "gemini":
          result = await geminiSynth(deps.geminiAuth, shared);
          break;
        case "inworld":
          result = await inworldSynth(deps.inworldKey, shared);
          break;
        default:
          result = await openAiSynth(deps.openai, shared);
      }
    } catch (err) {
      primaryErr = err;
    }

    // The provider produced real audio → use it.
    if (result && result.audioBuffer.length >= MIN_TTS_BYTES) return result;

    // Otherwise the provider either threw OR returned empty/truncated audio
    // (which would render as a SILENT coach message). Degrade to OpenAI's
    // reliable default voice so the user always hears something — even a backup
    // voice is better than silence. If OpenAI itself was the request, there's
    // nothing better to fall back to, so surface the failure.
    if (config.provider === "openai") {
      if (primaryErr) throw primaryErr;
      throw new Error("OpenAI TTS returned empty audio");
    }
    console.warn(
      `[tts] provider "${config.provider}" ${
        primaryErr
          ? `failed (${(primaryErr as Error).message})`
          : "returned empty audio"
      }; falling back to OpenAI "${FALLBACK_VOICE_ID}"`,
    );
    return openAiSynth(deps.openai, { ...shared, voiceId: FALLBACK_VOICE_ID });
  };
}
