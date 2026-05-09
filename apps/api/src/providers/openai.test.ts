import { describe, expect, it, vi } from "vitest";
import { streamChatCompletion } from "./openai";

describe("streamChatCompletion", () => {
  it("yields text deltas from the model", async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: "Hola" } }] };
      yield { choices: [{ delta: { content: " amigo" } }] };
      yield { choices: [{ delta: { content: "!" } }] };
    }
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(fakeStream()),
        },
      },
    };
    const deltas: string[] = [];
    for await (const delta of streamChatCompletion(fakeClient as never, {
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o-mini",
    })) {
      deltas.push(delta);
    }
    expect(deltas).toEqual(["Hola", " amigo", "!"]);
  });

  it("throws LLM_PROVIDER_FAILURE on error", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("rate limited")),
        },
      },
    };
    const stream = streamChatCompletion(fakeClient as never, {
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o-mini",
    });
    await expect(stream.next()).rejects.toMatchObject({
      code: "LLM_PROVIDER_FAILURE",
    });
  });
});
