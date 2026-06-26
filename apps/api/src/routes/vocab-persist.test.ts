import { describe, expect, it, vi } from "vitest";
import { persistVocab } from "./vocab-persist";

describe("persistVocab", () => {
  it("upserts each vocab item with onConflictDoNothing", async () => {
    const onConflictDoNothing = vi.fn(async () => {});
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as never;

    await persistVocab(db, {
      userId: "u1",
      language: "fr",
      vocab: [
        {
          term: "maison",
          translation: "house",
          source_phrase: "J'habite dans une maison.",
          article: "la",
        },
        { term: "chien", translation: "dog" },
      ],
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith({
      userId: "u1",
      language: "fr",
      term: "maison",
      translation: "house",
      sourceSentence: "J'habite dans une maison.",
      article: "la",
    });
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
  });

  it("skips items with an empty term", async () => {
    const onConflictDoNothing = vi.fn(async () => {});
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as never;

    await persistVocab(db, {
      userId: "u1",
      language: "fr",
      vocab: [{ term: "", translation: "x" }, { term: "chat" }],
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      userId: "u1",
      language: "fr",
      term: "chat",
      translation: null,
      sourceSentence: null,
      article: null,
    });
  });

  it("does nothing for an empty array", async () => {
    const insert = vi.fn();
    const db = { insert } as never;
    await persistVocab(db, { userId: "u1", language: "fr", vocab: [] });
    expect(insert).not.toHaveBeenCalled();
  });
});
