import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";

// NOTE: The exact Inworld endpoint, auth scheme, request/response field names,
// and voice IDs are to be verified against live Inworld docs at integration
// time. The model/url below are isolated constants so a tier/model change is
// one edit. "inworld-tts-1.5" == the Max tier.
const INWORLD_TTS_MODEL = "inworld-tts-1.5";
const INWORLD_TTS_URL = "https://api.inworld.ai/tts/v1/voice";

export async function synthesizeSpeechInworld(
  apiKey: string | undefined,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  if (!apiKey) {
    throw new ProviderError(
      "TTS_PROVIDER_NOT_CONFIGURED",
      503,
      "Inworld API key not configured",
    );
  }

  // Inworld API keys are issued as a base64 string used directly as Basic auth.
  const speakingRate = Math.min(1.2, Math.max(0.7, input.speed ?? 1.0));

  let json: { audioContent?: string };
  try {
    const res = await fetch(INWORLD_TTS_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        voiceId: input.voiceId,
        modelId: INWORLD_TTS_MODEL,
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${detail}`);
    }
    json = await res.json();
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Inworld error: ${(err as Error).message}`,
    );
  }

  if (!json.audioContent) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      "Inworld error: no audio in response",
    );
  }

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "inworld",
        operation: `tts:${INWORLD_TTS_MODEL}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return {
    audioBuffer: Buffer.from(json.audioContent, "base64"),
    contentType: "audio/mpeg",
  };
}
