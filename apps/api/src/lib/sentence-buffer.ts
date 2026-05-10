/**
 * Streams text deltas in, emits complete sentences out.
 *
 * A sentence is anything terminated by `.`, `!`, or `?` followed by whitespace
 * (or end-of-stream when flush() is called). Multiple terminators in a row are
 * treated as one (e.g. "Wait...").
 *
 * Edge cases like "Mr. Smith" or "U.S.A." may produce extra splits — acceptable
 * cost for v1.
 */
export class SentenceBuffer {
  private buffer = "";

  /** Append text. Returns any complete sentences that became available. */
  push(delta: string): string[] {
    this.buffer += delta;
    const sentences: string[] = [];

    // Match: anything up to a terminator sequence, followed by whitespace.
    const re = /^([\s\S]*?[.!?]+)(\s+)/;

    while (true) {
      const m = this.buffer.match(re);
      if (!m) break;
      sentences.push(m[1].trim());
      this.buffer = this.buffer.slice(m[0].length);
    }

    return sentences;
  }

  /** Drain whatever is left in the buffer. Returns "" if already empty. */
  flush(): string {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining;
  }
}
