import { describe, expect, it } from "vitest";
import { isPronunciationCorrect, normalizeForMatch } from "./vocab-match";

describe("normalizeForMatch", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalizeForMatch("  Café! ")).toBe("cafe");
    expect(normalizeForMatch("Über-Müde.")).toBe("uber mude");
  });
});

describe("isPronunciationCorrect", () => {
  it("accepts an exact match", () => {
    expect(isPronunciationCorrect("maison", "maison")).toBe(true);
  });

  it("accepts accent/case/punctuation differences", () => {
    expect(isPronunciationCorrect("Café.", "café")).toBe(true);
    expect(isPronunciationCorrect("MAISON", "maison")).toBe(true);
  });

  it("accepts when STT adds surrounding words", () => {
    expect(isPronunciationCorrect("the house maison", "maison")).toBe(true);
    expect(isPronunciationCorrect("ich sage Einkauf", "Einkauf")).toBe(true);
  });

  it("accepts a small slip within tolerance", () => {
    expect(isPronunciationCorrect("maisN", "maison")).toBe(true); // 1 edit / 6
  });

  it("rejects a clearly different word", () => {
    expect(isPronunciationCorrect("chien", "maison")).toBe(false);
  });

  it("rejects empty / silent transcript", () => {
    expect(isPronunciationCorrect("", "maison")).toBe(false);
    expect(isPronunciationCorrect("   ", "maison")).toBe(false);
  });
});
