import { describe, it, expect, vi } from "vitest";
import { runTurn } from "./run-turn";

async function* fakeLLM() {
  yield "Hello. ";
  yield "How are you?";
}

describe("runTurn", () => {
  it("buffers sentences and emits one chunk (with audio) per sentence", async () => {
    const synthesizeSpeech = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from([9]),
      contentType: "audio/mpeg",
    });
    const chunks: { index: number; text: string; audioLen: number }[] = [];
    const out = await runTurn(
      { streamChatCompletion: () => fakeLLM(), synthesizeSpeech },
      {
        messages: [{ role: "user", content: "hi" }],
        languageCode: "en",
        isPro: true,
      },
      (c) => {
        chunks.push({
          index: c.index,
          text: c.text,
          audioLen: c.audio.audioBuffer.length,
        });
      },
    );
    expect(out.fullText).toBe("Hello. How are you?");
    expect(chunks.map((c) => c.text)).toEqual(["Hello.", "How are you?"]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(chunks[0]!.audioLen).toBe(1);
  });

  it("routes a failed chunk synth to onChunkError, not onChunk", async () => {
    const synthesizeSpeech = vi
      .fn()
      .mockResolvedValueOnce({
        audioBuffer: Buffer.from([1]),
        contentType: "audio/mpeg",
      })
      .mockRejectedValueOnce(new Error("tts boom"));
    const ok: string[] = [];
    const errs: number[] = [];
    await runTurn(
      { streamChatCompletion: () => fakeLLM(), synthesizeSpeech },
      { messages: [], languageCode: "en", isPro: true },
      (c) => {
        ok.push(c.text);
      },
      (index) => {
        errs.push(index);
      },
    );
    expect(ok).toEqual(["Hello."]);
    expect(errs).toEqual([1]);
  });

  it("stops starting new sentences once the abort signal fires", async () => {
    const ac = new AbortController();
    const synthesizeSpeech = vi.fn().mockImplementation(async () => {
      ac.abort(); // first synth triggers a barge-in mid-turn
      return { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };
    });
    const chunks: string[] = [];
    await runTurn(
      { streamChatCompletion: () => fakeLLM(), synthesizeSpeech },
      { messages: [], languageCode: "en", isPro: true, signal: ac.signal },
      (c) => {
        chunks.push(c.text);
      },
    );
    // First sentence was already in flight; the second is never started.
    expect(chunks).toEqual(["Hello."]);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
  });
});
