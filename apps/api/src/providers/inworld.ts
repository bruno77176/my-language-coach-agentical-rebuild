import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";

// Verified against docs.inworld.ai (2026-06-03): endpoint, `Basic` auth, the
// `text`/`voiceId`/`modelId`/`audioConfig` request fields, and the `audioContent`
// base64 response all match. The Max-tier model id is "inworld-tts-1.5-max"
// ("inworld-tts-1.5-mini" is the cheaper tier). Isolated so a tier swap is one edit.
const INWORLD_TTS_MODEL = "inworld-tts-1.5-max";
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
    json = (await res.json()) as typeof json;
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
