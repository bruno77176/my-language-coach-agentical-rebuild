import { describe, it, expect, vi } from "vitest";
import { embedTexts } from "./embed-texts";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeClient(vectors: number[][]) {
  return {
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: vectors.map((embedding, index) => ({ embedding, index })),
        usage: { prompt_tokens: 3, total_tokens: 3 },
      }),
    },
  } as any;
}

describe("embedTexts", () => {
  it("returns one vector per input text, in order", async () => {
    const client = fakeClient([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const out = await embedTexts(client, ["a", "b"]);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
  it("returns nulls (does not throw) when the API fails", async () => {
    const client = {
      embeddings: { create: vi.fn().mockRejectedValue(new Error("boom")) },
    } as any;
    const out = await embedTexts(client, ["a", "b"]);
    expect(out).toEqual([null, null]);
  });
  it("returns [] for empty input without calling the API", async () => {
    const client = fakeClient([]);
    const out = await embedTexts(client, []);
    expect(out).toEqual([]);
    expect(client.embeddings.create).not.toHaveBeenCalled();
  });
});
