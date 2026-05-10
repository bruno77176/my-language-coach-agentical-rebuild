import { describe, expect, it, vi } from "vitest";
import { AudioQueue, type Chunk } from "./audio-queue";

function makeChunk(index: number): Chunk {
  return {
    index,
    text: `text-${index}`,
    audioUrl: `https://example.com/${index}.mp3`,
    durationMs: 100,
  };
}

describe("AudioQueue", () => {
  it("plays chunks in index order even if enqueued out of order", async () => {
    const played: number[] = [];
    const q = new AudioQueue({
      playChunk: async (c) => {
        played.push(c.index);
      },
    });
    q.enqueue(makeChunk(2));
    q.enqueue(makeChunk(0));
    q.enqueue(makeChunk(1));
    await q.waitForDrain();
    expect(played).toEqual([0, 1, 2]);
  });

  it("plays chunks as they arrive in order", async () => {
    const played: number[] = [];
    const q = new AudioQueue({
      playChunk: async (c) => {
        played.push(c.index);
      },
    });
    q.enqueue(makeChunk(0));
    q.enqueue(makeChunk(1));
    await q.waitForDrain();
    expect(played).toEqual([0, 1]);
  });

  it("reset clears state", async () => {
    const playChunk = vi.fn(async () => {});
    const q = new AudioQueue({ playChunk });
    q.enqueue(makeChunk(0));
    q.reset();
    q.enqueue(makeChunk(0));
    await q.waitForDrain();
    expect(playChunk).toHaveBeenCalledTimes(2);
  });

  it("isPlaying reflects activity", async () => {
    let release: () => void = () => {};
    const q = new AudioQueue({
      playChunk: () =>
        new Promise<void>((r) => {
          release = r;
        }),
    });
    q.enqueue(makeChunk(0));
    await new Promise((r) => setTimeout(r, 0));
    expect(q.isPlaying()).toBe(true);
    release();
    await q.waitForDrain();
    expect(q.isPlaying()).toBe(false);
  });
});
