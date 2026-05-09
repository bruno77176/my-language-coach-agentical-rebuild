import type { DeepgramClient } from "@deepgram/sdk";
import { DeepgramClient as DeepgramClientCtor } from "@deepgram/sdk";
import type { Env } from "../env";

export type TranscribeInput = {
  audioBuffer: Buffer;
  languageCode: string; // ISO 639-1
};

export type TranscribeResult = {
  text: string;
  durationSeconds: number;
};

export class ProviderError extends Error {
  constructor(
    public code:
      | "STT_PROVIDER_FAILURE"
      | "LLM_PROVIDER_FAILURE"
      | "TTS_PROVIDER_FAILURE"
      | "AUDIO_SILENT"
      | "AUDIO_TOO_SHORT"
      | "AUDIO_TOO_LONG"
      | "QUOTA_EXCEEDED",
    public httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function createDeepgram(env: Env): DeepgramClient {
  return new DeepgramClientCtor({ apiKey: env.DEEPGRAM_API_KEY });
}

export async function transcribeAudio(
  client: DeepgramClient,
  input: TranscribeInput,
): Promise<TranscribeResult> {
  let response;
  try {
    response = await client.listen.v1.media.transcribeFile(input.audioBuffer, {
      model: "nova-3",
      language: input.languageCode,
      smart_format: true,
      punctuate: true,
    });
  } catch (err) {
    throw new ProviderError(
      "STT_PROVIDER_FAILURE",
      503,
      `Deepgram error: ${(err as Error).message}`,
    );
  }

  // The transcribeFile() endpoint can return either a sync ListenV1Response
  // (with results + metadata) or an async ListenV1AcceptedResponse (callback
  // mode). We only ever call it in sync mode, so narrow to the sync shape.
  const syncResult = response as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
    metadata?: { duration?: number };
  };

  const text =
    syncResult.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ??
    "";
  const durationSeconds = syncResult.metadata?.duration ?? 0;

  if (!text) {
    throw new ProviderError(
      "AUDIO_SILENT",
      422,
      "Transcript was empty — likely silent audio.",
    );
  }

  return { text, durationSeconds };
}
