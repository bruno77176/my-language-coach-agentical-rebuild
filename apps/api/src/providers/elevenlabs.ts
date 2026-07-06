import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";
import type { OnUsage } from "./usage";
import type { TtsStyle } from "@language-coach/shared";
import { elevenLabsStyleSettings } from "./tts-config";
import { withTimeout } from "../lib/timeout";

// Latency bound for a single ElevenLabs synthesis (open + full drain). The
// default provider had NO timeout, so a hung stream (open or mid-drain) held
// the turn forever — the fallback router only rescues on throw/empty, not on
// hang (INF-1). Flash v2.5 streams sub-second; 10s is a generous ceiling.
const EL_SYNTH_TIMEOUT_MS = 10_000;

export function createElevenLabs(env: Env): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
}

export type SynthesizeInput = {
  text: string;
  voiceId: string;
  // Target language of `text`; threaded through so the active TTS provider can
  // pin the spoken language instead of auto-detecting it (see openai.ts).
  languageCode?: string;
  speed?: number;
  style?: TtsStyle;
  modelId?: string;
  onUsage?: OnUsage;
};

export type SynthesizeResult = {
  audioBuffer: Buffer;
  contentType: string;
};

export async function synthesizeSpeech(
  client: ElevenLabsClient,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  const settings = elevenLabsStyleSettings(input.style ?? "warm");
  const elSpeed = Math.min(1.2, Math.max(0.7, input.speed ?? 1.0));

  // Open the stream AND drain it under a single latency bound. Cast: SDK types
  // stream() as ReadableStream<Uint8Array>, but Web ReadableStream is
  // async-iterable in Node 20+ and tests mock it as a plain AsyncGenerator.
  const collect = async (): Promise<Buffer> => {
    const stream = (await client.textToSpeech.stream(input.voiceId, {
      text: input.text,
      modelId: input.modelId ?? "eleven_flash_v2_5",
      languageCode: input.languageCode,
      voiceSettings: {
        stability: settings.stability,
        style: settings.style,
        speed: elSpeed,
      },
      outputFormat: "mp3_44100_128",
    })) as unknown as AsyncIterable<Uint8Array>;
    const parts: Uint8Array[] = [];
    for await (const chunk of stream) {
      parts.push(chunk);
    }
    return Buffer.concat(parts);
  };

  let audioBuffer: Buffer;
  try {
    audioBuffer = await withTimeout(
      collect(),
      EL_SYNTH_TIMEOUT_MS,
      "ElevenLabs synth",
    );
  } catch (err) {
    // Includes TimeoutError — surfaces as TTS_PROVIDER_FAILURE so the router
    // falls back to OpenAI instead of the turn hanging.
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `ElevenLabs error: ${(err as Error).message}`,
    );
  }

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "elevenlabs",
        operation: `tts:${input.modelId ?? "eleven_flash_v2_5"}`,
        characters: input.text.length,
      }),
    ).catch(() => {
      // fire-and-forget; recordUsage reports to Sentry on its own
    });
  }

  // ElevenLabs can close the stream with 0 bytes on a soft limit (concurrency /
  // quota) WITHOUT throwing — which would otherwise surface as a silent coach
  // message. Treat empty audio as a failure so the router falls back to OpenAI.
  if (audioBuffer.length === 0) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      502,
      "ElevenLabs returned empty audio",
    );
  }

  return {
    audioBuffer,
    contentType: "audio/mpeg",
  };
}
