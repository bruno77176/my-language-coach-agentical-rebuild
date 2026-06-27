import { describe, it, expect, vi } from "vitest";
import { generateLessonPlan } from "./generate-lesson-plan";

/* eslint-disable @typescript-eslint/no-explicit-any */

function client(content: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 5, completion_tokens: 5 },
        }),
      },
    },
  } as any;
}

describe("generateLessonPlan", () => {
  it("returns a parsed plan", async () => {
    const c = client(
      JSON.stringify({
        focus: "dative prepositions",
        target_structures: ["mit + dative"],
        suggested_topics: ["cooking"],
        callbacks: ["their dog Rex"],
      }),
    );
    const out = await generateLessonPlan(c, {
      items: [{ type: "mistake", content: "x" }],
      proficiencyLevel: "B1",
      languageCode: "de",
    });
    expect(out?.focus).toBe("dative prepositions");
  });
  it("returns null on invalid json", async () => {
    const out = await generateLessonPlan(client("nope"), {
      items: [],
      proficiencyLevel: null,
      languageCode: "de",
    });
    expect(out).toBeNull();
  });
});
