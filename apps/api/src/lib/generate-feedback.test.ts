import { describe, expect, it, vi } from "vitest";
import { generateFeedback } from "./generate-feedback";

/* eslint-disable @typescript-eslint/no-explicit-any */

function clientReturning(...contents: (string | { refusal: string })[]) {
  const create = vi.fn();
  for (const content of contents) {
    const message =
      typeof content === "string"
        ? { content }
        : { content: null, refusal: content.refusal };
    create.mockResolvedValueOnce({
      choices: [{ message }],
      usage: { prompt_tokens: 600, completion_tokens: 180 },
    });
  }
  return { chat: { completions: { create } }, __create: create } as any;
}

const GOOD = JSON.stringify({
  highlights: [{ phrase: "Buongiorno!", why: "Natural greeting." }],
  corrections: [
    {
      you_said: "io andato",
      better: "io sono andato",
      explanation: "Motion verbs in Italian use 'essere'.",
    },
  ],
  vocab: [{ term: "panino", translation: "sandwich" }],
});

const input = {
  transcript: [
    { role: "user" as const, text: "Buongiorno!" },
    { role: "coach" as const, text: "Ciao!" },
  ],
  languageCode: "it",
  nativeLanguageCode: "en",
};

describe("generateFeedback", () => {
  it("returns parsed feedback on happy path", async () => {
    const out = await generateFeedback(clientReturning(GOOD), input);
    expect(out).not.toBeNull();
    expect(out!.corrections[0]!.better).toBe("io sono andato");
  });

  it("retries a transient API error and succeeds", async () => {
    const create = vi.fn();
    create.mockRejectedValueOnce(new Error("503 upstream"));
    create.mockResolvedValueOnce({
      choices: [{ message: { content: GOOD } }],
      usage: { prompt_tokens: 600, completion_tokens: 180 },
    });
    const client = { chat: { completions: { create } } } as any;
    const out = await generateFeedback(client, input);
    expect(out).not.toBeNull();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries when the model returns a refusal / empty content", async () => {
    const client = clientReturning(
      { refusal: "I can't help with that." },
      GOOD,
    );
    const out = await generateFeedback(client, input);
    expect(out).not.toBeNull();
    expect(client.__create).toHaveBeenCalledTimes(2);
  });

  it("tolerates an extra top-level key (does not nuke the whole report)", async () => {
    const withExtra = JSON.stringify({
      summary: "Great chat!", // extra key that .strict() would reject
      highlights: [{ phrase: "Buongiorno!", why: "Natural greeting." }],
      corrections: [],
      vocab: [{ term: "panino", translation: "sandwich" }],
    });
    const out = await generateFeedback(clientReturning(withExtra), input);
    expect(out).not.toBeNull();
    expect(out!.vocab[0]!.term).toBe("panino");
  });

  it("drops a single malformed item but keeps the valid ones", async () => {
    const partlyBad = JSON.stringify({
      highlights: [{ phrase: "Buongiorno!", why: "Natural greeting." }],
      corrections: [
        {
          you_said: "",
          better: "io sono andato",
          explanation: "bad: empty you_said",
        },
        {
          you_said: "io andato",
          better: "io sono andato",
          explanation: "Motion verbs use 'essere'.",
        },
      ],
      vocab: [],
    });
    const out = await generateFeedback(clientReturning(partlyBad), input);
    expect(out).not.toBeNull();
    // The empty-you_said correction is dropped; the valid one survives.
    expect(out!.corrections).toHaveLength(1);
    expect(out!.corrections[0]!.you_said).toBe("io andato");
  });

  it("clamps an over-long explanation instead of discarding the correction", async () => {
    const longExpl = "a".repeat(900);
    const over = JSON.stringify({
      highlights: [],
      corrections: [{ you_said: "x", better: "y", explanation: longExpl }],
      vocab: [],
    });
    const out = await generateFeedback(clientReturning(over), input);
    expect(out).not.toBeNull();
    expect(out!.corrections).toHaveLength(1);
    expect(out!.corrections[0]!.explanation.length).toBeLessThanOrEqual(600);
  });

  it("returns null only after exhausting all attempts", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    const client = { chat: { completions: { create } } } as any;
    const out = await generateFeedback(client, input);
    expect(out).toBeNull();
    expect(create.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
