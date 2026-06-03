import { LANGUAGES } from "@language-coach/shared";
import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";
import { openAiStylePhrase, pacePhrase } from "./tts-config";
import { pcmToWav } from "./audio";

// Model id is isolated here — Gemini TTS model naming may need a tweak once
// verified against the live API (see spec).
const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts";

function buildPrompt(input: SynthesizeInput): string {
  const lang = input.languageCode
    ? LANGUAGES.find((l) => l.code === input.languageCode)
    : undefined;
  const style = openAiStylePhrase(input.style ?? "warm");
  const pace = pacePhrase(input.speed ?? 1.0);
  const langClause = lang
    ? `Speak in ${lang.englishName} with a natural, native accent. `
    : "";
  // Gemini TTS has no native speed param; pace + style are conveyed in prose.
  return `${langClause}Use ${style} and ${pace}.\n\n${input.text}`;
}

function parseSampleRate(mimeType: string | undefined): number {
  // e.g. "audio/L16;rate=24000"
  const m = mimeType?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : 24000;
}

export async function synthesizeSpeechGemini(
  apiKey: string | undefined,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  if (!apiKey) {
    throw new ProviderError(
      "TTS_PROVIDER_NOT_CONFIGURED",
      503,
      "Gemini API key not configured",
    );
  }

  let json: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
      };
    }>;
  };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: input.voiceId },
              },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${detail}`);
    }
    json = (await res.json()) as typeof json;
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Gemini error: ${(err as Error).message}`,
    );
  }

  const part = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      "Gemini error: no audio in response",
    );
  }

  const pcm = Buffer.from(part.data, "base64");
  const audioBuffer = pcmToWav(pcm, {
    sampleRate: parseSampleRate(part.mimeType),
  });

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "gemini",
        operation: `tts:${GEMINI_TTS_MODEL}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return { audioBuffer, contentType: "audio/wav" };
}
