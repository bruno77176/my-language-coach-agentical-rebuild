import { describe, it, expect, vi } from "vitest";
import { selectMemoryForPrompt } from "./select-memory";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("selectMemoryForPrompt", () => {
  it("returns mapped {type,content} from active items, honoring the limit", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { type: "mistake", content: "uses dative wrong" },
      { type: "persona_detail", content: "has a dog named Rex" },
    ]);
    const db = { query: { memoryItems: { findMany } } } as any;
    const out = await selectMemoryForPrompt(db, {
      userId: "u1",
      languageCode: "de",
      limit: 5,
    });
    expect(out).toEqual([
      { type: "mistake", content: "uses dative wrong" },
      { type: "persona_detail", content: "has a dog named Rex" },
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0]?.[0];
    expect(arg?.limit).toBe(5);
  });
  it("defaults limit to 8", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { query: { memoryItems: { findMany } } } as any;
    await selectMemoryForPrompt(db, { userId: "u1", languageCode: "de" });
    expect(findMany.mock.calls[0]?.[0]?.limit).toBe(8);
  });
});
