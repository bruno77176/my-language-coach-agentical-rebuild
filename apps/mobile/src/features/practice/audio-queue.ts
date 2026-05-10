export type Chunk = {
  index: number;
  text: string;
  audioUrl: string;
  durationMs: number;
};

export type AudioQueueDeps = {
  /** Plays one chunk to completion. Resolves when audio finishes (or fails silently). */
  playChunk: (chunk: Chunk) => Promise<void>;
};

/**
 * Pure queue logic for ordered chunk playback. No audio API knowledge —
 * the playChunk adapter does the actual playback. Testable in isolation.
 */
export class AudioQueue {
  private chunks = new Map<number, Chunk>();
  private nextToPlay = 0;
  private playing = false;
  private drainResolvers: Array<() => void> = [];

  constructor(private deps: AudioQueueDeps) {}

  enqueue(chunk: Chunk): void {
    this.chunks.set(chunk.index, chunk);
    if (!this.playing) {
      void this.drain();
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  reset(): void {
    this.chunks.clear();
    this.nextToPlay = 0;
    this.playing = false;
    this.drainResolvers = [];
  }

  /** Resolves when the queue has finished playing everything currently enqueued. */
  waitForDrain(): Promise<void> {
    if (!this.playing && !this.chunks.has(this.nextToPlay)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private async drain(): Promise<void> {
    this.playing = true;
    while (this.chunks.has(this.nextToPlay)) {
      const chunk = this.chunks.get(this.nextToPlay)!;
      try {
        await this.deps.playChunk(chunk);
      } catch {
        // best-effort: skip
      }
      this.chunks.delete(this.nextToPlay);
      this.nextToPlay += 1;
    }
    this.playing = false;
    const resolvers = this.drainResolvers.splice(0);
    for (const r of resolvers) r();
  }
}
