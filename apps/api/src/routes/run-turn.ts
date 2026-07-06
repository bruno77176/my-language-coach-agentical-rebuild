import { SentenceBuffer } from "../lib/sentence-buffer";
import type { StreamInput, ChatMessage, TtsResult } from "../providers/openai";
import type { RoutedTtsInput } from "../providers/tts-router";
import type { OnUsage } from "../providers/usage";
import type { TtsConfig } from "@language-coach/shared";

export type SynthesizeSpeechFn = (input: RoutedTtsInput) => Promise<TtsResult>;

export type RunTurnDeps = {
  streamChatCompletion: (input: StreamInput) => AsyncGenerator<string>;
  synthesizeSpeech: SynthesizeSpeechFn;
};

// One synthesized coach sentence. `audio` is the raw TTS result so each
// transport delivers it its own way (SSE inline base64 / SSE signed-URL upload
// / WS base64) — runTurn stays transport-agnostic.
export type RunTurnChunk = { index: number; text: string; audio: TtsResult };

export type RunTurnInput = {
  messages: ChatMessage[];
  languageCode: string;
  ttsConfig?: TtsConfig;
  model?: string;
  onUsage?: OnUsage;
  // Barge-in: when this aborts, runTurn stops starting new sentences. A
  // sentence already mid-synthesis may still be delivered.
  signal?: AbortSignal;
};

// Streams the LLM reply, segments it into sentences, synthesizes TTS per
// sentence concurrently, and emits each via `onChunk`. Shared by the SSE turn
// route and the Live WebSocket route. Per-sentence TTS failures go to
// `onChunkError` (the turn continues), mirroring the SSE route's behavior.
export async function runTurn(
  deps: RunTurnDeps,
  input: RunTurnInput,
  onChunk: (chunk: RunTurnChunk) => Promise<void> | void,
  onChunkError?: (index: number, err: unknown) => Promise<void> | void,
): Promise<{ fullText: string }> {
  const gptStream = deps.streamChatCompletion({
    messages: input.messages,
    model: input.model ?? "gpt-4o-mini",
    onUsage: input.onUsage,
  });

  const sentenceBuf = new SentenceBuffer();
  let chunkIndex = 0;
  let fullText = "";
  const ttsPromises: Promise<void>[] = [];

  const emit = async (text: string, index: number): Promise<void> => {
    if (input.signal?.aborted) return;
    let audio: TtsResult;
    try {
      audio = await deps.synthesizeSpeech({
        text,
        languageCode: input.languageCode,
        config: input.ttsConfig,
        onUsage: input.onUsage,
      });
    } catch (err) {
      // TEMP DIAG (revert after the ~8-min silent-voice repro): a synth failure
      // that even the OpenAI fallback couldn't rescue — the chunk ships with NO
      // audio. If this fires around minute 8, the cause is server-side TTS.
      console.warn(
        `[TTS-DIAG] SYNTH_FAIL chunk=${index} textLen=${text.length} err=${(err as Error)?.message}`,
      );
      await onChunkError?.(index, err);
      return;
    }
    // TEMP DIAG: per-chunk audio size. Healthy speech is many KB; a drop to ~0
    // (or SYNTH_FAIL above) around minute 8 pins the fault to the server. If
    // these stay healthy the whole session, the audio is lost on the device.
    console.warn(
      `[TTS-DIAG] chunk=${index} textLen=${text.length} audioBytes=${audio.audioBuffer.length} ct=${audio.contentType}`,
    );
    await onChunk({ index, text, audio });
  };

  for await (const delta of gptStream) {
    if (input.signal?.aborted) break;
    fullText += delta;
    for (const sentence of sentenceBuf.push(delta)) {
      ttsPromises.push(emit(sentence, chunkIndex++));
    }
  }

  const tail = sentenceBuf.flush();
  if (tail && !input.signal?.aborted) {
    ttsPromises.push(emit(tail, chunkIndex++));
  }

  await Promise.all(ttsPromises);
  return { fullText };
}
