import OpenAI from "openai";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";
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
    })) as AsyncIterable<{
      choices: Array<{ delta: { content?: string } }>;
    }>;
  } catch (err) {
    throw new ProviderError(
      "LLM_PROVIDER_FAILURE",
      503,
      `OpenAI error: ${(err as Error).message}`,
    );
  }

  try {
    for await (const chunk of stream) {
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
}

// ---- TTS via OpenAI (replaces ElevenLabs while we're on free tier) ----

export type TtsInput = {
  text: string;
  voiceId: string; // alloy | echo | fable | onyx | nova | shimmer
  modelId?: string;
};

export type TtsResult = {
  audioBuffer: Buffer;
  contentType: string;
};

export async function synthesizeSpeechOpenAI(
  client: OpenAI,
  input: TtsInput,
): Promise<TtsResult> {
  try {
    const response = await client.audio.speech.create({
      model: input.modelId ?? "tts-1",
      voice: input.voiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer",
      input: input.text,
      response_format: "mp3",
    });
    const arrayBuf = await response.arrayBuffer();
    return {
      audioBuffer: Buffer.from(arrayBuf),
      contentType: "audio/mpeg",
    };
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `OpenAI TTS error: ${(err as Error).message}`,
    );
  }
}

export type TranslateMessageInput = {
  text: string;
  targetLanguageCode: string;
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
  return translation;
}
