import OpenAI from "openai";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";
import type { OnUsage } from "./usage";
import { LANGUAGES } from "@language-coach/shared";
import { openAiStylePhrase, pacePhrase } from "./tts-config";

export function createOpenAI(env: Env): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamInput = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  onUsage?: OnUsage;
};

export async function* streamChatCompletion(
  client: OpenAI,
  input: StreamInput,
): AsyncGenerator<string> {
  let stream;
  try {
    stream = (await client.chat.completions.create({
      model: input.model ?? "gpt-4o-mini",
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
    })) as AsyncIterable<{
      choices: Array<{ delta: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
      model?: string;
    }>;
  } catch (err) {
    throw new ProviderError(
      "LLM_PROVIDER_FAILURE",
      503,
      `OpenAI error: ${(err as Error).message}`,
    );
  }

  let lastUsage:
    | { prompt_tokens: number; completion_tokens: number }
    | undefined;
  let lastModel: string | undefined;
  try {
    for await (const chunk of stream) {
      if (chunk.usage) lastUsage = chunk.usage;
      if (chunk.model) lastModel = chunk.model;
      const delta = chunk.choices[0]?.delta.content;
      if (delta) yield delta;
    }
  } catch (err) {
    throw new ProviderError(
      "LLM_PROVIDER_FAILURE",
      503,
      `OpenAI stream error: ${(err as Error).message}`,
    );
  }

  if (input.onUsage && lastUsage) {
    // Rate cards are keyed on the model alias (e.g. "gpt-4o-mini"), but
    // chunk.model returns the versioned weight name (e.g.
    // "gpt-4o-mini-2024-07-18"). Use the alias the caller requested so the
    // rate-card lookup hits. lastModel is unused; kept for future telemetry.
    void lastModel;
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `chat:${input.model ?? "gpt-4o-mini"}`,
        inputTokens: lastUsage.prompt_tokens,
        outputTokens: lastUsage.completion_tokens,
      }),
    ).catch(() => {
      // fire-and-forget; recordUsage reports to Sentry on its own
    });
  }
}

// ---- TTS via OpenAI (replaces ElevenLabs while we're on free tier) ----

export type TtsInput = {
  text: string;
  voiceId: string; // alloy | echo | fable | onyx | nova | shimmer
  // Target language of `text`. REQUIRED to get correct pronunciation: without
  // it the TTS model auto-detects language from the text, which fails ~25% of
  // the time on short/ambiguous chunks (esp. Spanish/Italian) and speaks the
  // text in the wrong language. See `ttsLanguageInstruction` below.
  languageCode?: string;
  speed?: number;
  style?: import("@language-coach/shared").TtsStyle;
  modelId?: string;
  onUsage?: OnUsage;
};

export type TtsResult = {
  audioBuffer: Buffer;
  contentType: string;
};

// gpt-4o-mini-tts is the only OpenAI TTS model that honors `instructions`
// (tts-1 / tts-1-hd ignore them and have no language parameter at all, so they
// CANNOT be told which language to speak — that's the root cause of the
// wrong-language voice bug). We force the language here instead of relying on
// auto-detection.
const TTS_MODEL = "gpt-4o-mini-tts";

// Build the steering instruction that pins the spoken language and keeps the
// delivery lively (counters the "too slow / unnatural" feel of un-instructed
// gpt-4o-mini-tts). Returns undefined for unknown codes so we degrade to the
// model's default behavior rather than injecting a bogus language name.
export function ttsLanguageInstruction(
  languageCode: string | undefined,
  style: import("@language-coach/shared").TtsStyle = "warm",
  speed = 1.0,
): string | undefined {
  if (!languageCode) return undefined;
  const lang = LANGUAGES.find((l) => l.code === languageCode);
  if (!lang) return undefined;
  return `Speak in ${lang.englishName} with a natural, native accent. Use ${openAiStylePhrase(style)} and ${pacePhrase(speed)}.`;
}

export async function synthesizeSpeechOpenAI(
  client: OpenAI,
  input: TtsInput,
): Promise<TtsResult> {
  const model = input.modelId ?? TTS_MODEL;
  const instructions = ttsLanguageInstruction(
    input.languageCode,
    input.style ?? "warm",
    input.speed ?? 1.0,
  );
  let arrayBuf: ArrayBuffer;
  try {
    const response = await client.audio.speech.create({
      model,
      voice: input.voiceId,
      input: input.text,
      response_format: "mp3",
      ...(input.speed ? { speed: input.speed } : {}),
      // Only gpt-4o-mini-tts honors instructions; harmless to omit otherwise.
      ...(instructions ? { instructions } : {}),
    });
    arrayBuf = await response.arrayBuffer();
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `OpenAI TTS error: ${(err as Error).message}`,
    );
  }

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `tts:${model}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return {
    audioBuffer: Buffer.from(arrayBuf),
    contentType: "audio/mpeg",
  };
}

export type TranslateMessageInput = {
  text: string;
  targetLanguageCode: string;
  onUsage?: OnUsage;
};

export async function translateMessage(
  client: OpenAI,
  input: TranslateMessageInput,
): Promise<string> {
  const lang = LANGUAGES.find((l) => l.code === input.targetLanguageCode);
  const targetName = lang?.englishName ?? input.targetLanguageCode;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a translator. Translate the user message into ${targetName}. Preserve tone and register. Do not add commentary or quotation marks.`,
      },
      { role: "user", content: input.text },
    ],
    temperature: 0,
  });

  const translation = completion.choices[0]?.message?.content?.trim();
  if (!translation) {
    throw new Error("openai_returned_empty_translation");
  }

  if (input.onUsage) {
    // Use the requested alias for rate-card matching; see streamChatCompletion.
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `chat:gpt-4o-mini`,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      }),
    ).catch(() => {});
  }

  return translation;
}
