import { describe, expect, it } from "vitest";
import { SentenceBuffer } from "./sentence-buffer";

describe("SentenceBuffer", () => {
  it("emits a sentence when push completes one", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hello.")).toEqual([]);
    expect(buf.push(" ")).toEqual(["Hello."]);
  });

  it("emits nothing for partial sentence", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hello")).toEqual([]);
    expect(buf.push(" world")).toEqual([]);
  });

  it("emits multiple sentences in one push", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hi! How are you? ")).toEqual(["Hi!", "How are you?"]);
  });

  it("handles question and exclamation marks", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("What? ")).toEqual(["What?"]);
    expect(buf.push("Wow! ")).toEqual(["Wow!"]);
  });

  it("flush returns remaining buffer if non-empty", () => {
    const buf = new SentenceBuffer();
    buf.push("Hi there");
    expect(buf.flush()).toBe("Hi there");
    expect(buf.flush()).toBe("");
  });

  it("flush returns empty string when buffer was already drained", () => {
    const buf = new SentenceBuffer();
    buf.push("Hi. ");
    expect(buf.flush()).toBe("");
  });

  it("preserves multi-byte chars", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("¿Cómo estás? ")).toEqual(["¿Cómo estás?"]);
  });
});
