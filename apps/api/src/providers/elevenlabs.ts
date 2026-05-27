import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";
import type { OnUsage } from "./usage";

export function createElevenLabs(env: Env): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
}

export type SynthesizeInput = {
  text: string;
  voiceId: string;
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
  let stream: AsyncIterable<Uint8Array>;
  try {
    // Cast: SDK types stream() as returning ReadableStream<Uint8Array>, but
    // Web ReadableStream is async-iterable in Node 20+ and our tests mock it
    // as a plain AsyncGenerator. Either way, `for await` consumes it.
    stream = (await client.textToSpeech.stream(input.voiceId, {
      text: input.text,
      modelId: input.modelId ?? "eleven_flash_v2_5",
      outputFormat: "mp3_44100_128",
    })) as unknown as AsyncIterable<Uint8Array>;
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `ElevenLabs error: ${(err as Error).message}`,
    );
  }

  const chunks: Uint8Array[] = [];
  try {
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `ElevenLabs stream error: ${(err as Error).message}`,
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

  return {
    audioBuffer: Buffer.concat(chunks),
    contentType: "audio/mpeg",
  };
}
