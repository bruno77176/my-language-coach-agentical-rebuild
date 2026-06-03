import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";
import { openAiStylePhrase, pacePhrase } from "./tts-config";
import type { AccessTokenProvider } from "../lib/google-tts-auth";

// GA (stable) Gemini-TTS model on the Cloud Text-to-Speech API. Unlike the
// "-preview" models on the generativelanguage (AI Studio) endpoint, the GA
// model has production rate limits — which is what makes it usable as the
// default voice under the app's per-turn burst of chunk synthesis. Isolated
// here so a model bump is one edit.
const GEMINI_TTS_MODEL = "gemini-2.5-flash-tts";

// Cloud TTS wants a BCP-47 languageCode in the voice object. The gemini-tts
// prebuilt voices (Kore, …) are multilingual, but the field is required.
const BCP47: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
  pt: "pt-PT",
  tr: "tr-TR",
  sv: "sv-SE",
  da: "da-DK",
  ru: "ru-RU",
  ro: "ro-RO",
  hu: "hu-HU",
  ja: "ja-JP",
  zh: "cmn-CN",
  ko: "ko-KR",
};

function bcp47(code: string | undefined): string {
  return (code && BCP47[code]) || "en-US";
}

// A request that hangs (or a slow synth) must not stall the whole turn — the
// audio queue waits on it. Cap it so a failure falls through to the router's
// OpenAI fallback quickly instead of blocking.
const REQUEST_TIMEOUT_MS = 8000;

export async function synthesizeSpeechGemini(
  getAccessToken: AccessTokenProvider | undefined,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  if (!getAccessToken) {
    throw new ProviderError(
      "TTS_PROVIDER_NOT_CONFIGURED",
      503,
      "Gemini (Cloud TTS) service account not configured",
    );
  }

  // GA Cloud TTS requires an OAuth2 access token (API keys are rejected 401).
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Gemini (Cloud TTS) auth failed: ${(err as Error).message}`,
    );
  }

  const style = openAiStylePhrase(input.style ?? "warm");
  const pace = pacePhrase(input.speed ?? 1.0);
  // Cloud TTS gemini-tts steers delivery via the `prompt`; `text` is the
  // content to read. Speed isn't a native param — it's conveyed in prose.
  const prompt = `Speak with ${style} and ${pace}.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: { prompt, text: input.text },
          voice: {
            languageCode: bcp47(input.languageCode),
            name: input.voiceId,
            modelName: GEMINI_TTS_MODEL,
          },
          audioConfig: { audioEncoding: "MP3" },
        }),
        signal: controller.signal,
      },
    );
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Gemini (Cloud TTS) request failed: ${(err as Error).name} ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Gemini (Cloud TTS) HTTP ${res.status}: ${detail}`,
    );
  }

  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      "Gemini (Cloud TTS): no audioContent in response",
    );
  }

  const audioBuffer = Buffer.from(json.audioContent, "base64");

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "gemini",
        operation: `tts:${GEMINI_TTS_MODEL}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return { audioBuffer, contentType: "audio/mpeg" };
}
