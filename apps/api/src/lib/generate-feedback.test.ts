import { describe, expect, it, vi } from "vitest";
import { generateFeedback } from "./generate-feedback";

/* eslint-disable @typescript-eslint/no-explicit-any */

const okClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                highlights: [
                  { phrase: "Buongiorno!", why: "Natural greeting." },
                ],
                corrections: [
                  {
                    you_said: "io andato",
                    better: "io sono andato",
                    explanation: "Motion verbs in Italian use 'essere'.",
                  },
                ],
                vocab: [{ term: "panino", translation: "sandwich" }],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 600, completion_tokens: 180 },
      }),
    },
  },
};

describe("generateFeedback", () => {
  it("returns parsed feedback on happy path", async () => {
    const out = await generateFeedback(okClient as any, {
      transcript: [
        { role: "user", text: "Buongiorno!" },
        { role: "coach", text: "Ciao!" },
      ],
      languageCode: "it",
      nativeLanguageCode: "en",
    });
    expect(out).not.toBeNull();
    expect(out!.corrections[0]!.better).toBe("io sono andato");
  });

  it("returns null on invalid JSON", async () => {
    const badClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json" } }],
            usage: { prompt_tokens: 100, completion_tokens: 10 },
          }),
        },
      },
    };
    const out = await generateFeedback(badClient as any, {
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
      nativeLanguageCode: "en",
    });
    expect(out).toBeNull();
  });
});
