import OpenAI from "openai";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";
import type { OnUsage } from "./usage";
import { LANGUAGES } from "@language-coach/shared";

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
  modelId?: string;
  onUsage?: OnUsage;
};

export type TtsResult = {
  audioBuffer: Buffer;
  contentType: string;
};

// Product-wide voice persona. gpt-4o-mini-tts is the only model that accepts
// `instructions`; the default model speed is too slow and a bit flat without
// nudging, so we bump speed to 1.2 and shape the tone via instructions. Bruno
// picked this combination after A/B'ing Italian samples.
const TTS_SPEED = 1.2;
const TTS_INSTRUCTIONS =
  "Speak in a warm, friendly, conversational tone at a natural lively pace, like a language teacher having a relaxed chat with a friend.";

export async function synthesizeSpeechOpenAI(
  client: OpenAI,
  input: TtsInput,
): Promise<TtsResult> {
  const model = input.modelId ?? "gpt-4o-mini-tts";
  let arrayBuf: ArrayBuffer;
  try {
    const args: Parameters<typeof client.audio.speech.create>[0] = {
      model,
      voice: input.voiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer",
      input: input.text,
      speed: TTS_SPEED,
      response_format: "mp3",
    };
    // `instructions` is rejected by tts-1 / tts-1-hd; only attach for
    // gpt-4o-mini-tts (and future models that opt in).
    if (model === "gpt-4o-mini-tts") {
      (args as { instructions?: string }).instructions = TTS_INSTRUCTIONS;
    }
    const response = await client.audio.speech.create(args);
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
        operation: `tts:${input.modelId ?? "gpt-4o-mini-tts"}`,
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
