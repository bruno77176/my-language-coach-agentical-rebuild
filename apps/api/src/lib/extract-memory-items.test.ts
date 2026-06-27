import { describe, it, expect, vi } from "vitest";
import { extractMemoryItems } from "./extract-memory-items";

/* eslint-disable @typescript-eslint/no-explicit-any */

function clientReturning(jsonContent: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: jsonContent } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      },
    },
  } as any;
}

describe("extractMemoryItems", () => {
  it("parses a validated candidate list from the model", async () => {
    const client = clientReturning(
      JSON.stringify({
        items: [
          {
            type: "mistake",
            content: "says 'meine Niveau' instead of 'mein Niveau'",
          },
          { type: "persona_detail", content: "has a partner; wants children" },
        ],
      }),
    );
    const out = await extractMemoryItems(client, {
      transcript: [{ role: "user", text: "..." }],
      languageCode: "de",
    });
    expect(out.map((i) => i.type)).toEqual(["mistake", "persona_detail"]);
  });
  it("returns [] on invalid JSON", async () => {
    const client = clientReturning("not json");
    const out = await extractMemoryItems(client, {
      transcript: [],
      languageCode: "de",
    });
    expect(out).toEqual([]);
  });
});
