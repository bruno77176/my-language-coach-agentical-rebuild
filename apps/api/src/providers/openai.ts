import OpenAI from "openai";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";

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
