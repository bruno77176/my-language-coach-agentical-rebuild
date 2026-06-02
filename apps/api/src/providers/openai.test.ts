import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  streamChatCompletion,
  synthesizeSpeechOpenAI,
  translateMessage,
  ttsLanguageInstruction,
} from "./openai";

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

describe("openai usage instrumentation", () => {
  it("calls onUsage exactly once with input/output tokens after non-streaming completion", async () => {
    const onUsage = vi.fn();
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "salut" } }],
            model: "gpt-4o-mini",
            usage: { prompt_tokens: 12, completion_tokens: 4 },
          }),
        },
      },
    } as unknown as OpenAI;

    await translateMessage(mockClient, {
      text: "hello",
      targetLanguageCode: "fr",
      onUsage,
    });

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "chat:gpt-4o-mini",
        inputTokens: 12,
        outputTokens: 4,
      }),
    );
  });

  it("onUsage failure does not break translateMessage", async () => {
    const onUsage = vi.fn().mockRejectedValue(new Error("db down"));
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "salut" } }],
            model: "gpt-4o-mini",
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        },
      },
    } as unknown as OpenAI;
    const out = await translateMessage(mockClient, {
      text: "hi",
      targetLanguageCode: "fr",
      onUsage,
    });
    expect(out).toBe("salut");
  });

  it("streamChatCompletion calls onUsage with usage from final chunk", async () => {
    const onUsage = vi.fn();
    async function* fakeStream() {
      yield { choices: [{ delta: { content: "Hi" } }], model: "gpt-4o-mini" };
      yield { choices: [{ delta: { content: "!" } }], model: "gpt-4o-mini" };
      // Usage arrives in a final chunk with empty deltas (OpenAI behavior
      // when stream_options.include_usage = true).
      yield {
        choices: [{ delta: {} }],
        model: "gpt-4o-mini",
        usage: { prompt_tokens: 25, completion_tokens: 7 },
      };
    }
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(fakeStream()),
        },
      },
    } as unknown as OpenAI;

    const deltas: string[] = [];
    for await (const delta of streamChatCompletion(fakeClient, {
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o-mini",
      onUsage,
    })) {
      deltas.push(delta);
    }
    expect(deltas).toEqual(["Hi", "!"]);
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "chat:gpt-4o-mini",
        inputTokens: 25,
        outputTokens: 7,
      }),
    );
  });

  it("synthesizeSpeechOpenAI calls onUsage with characters", async () => {
    const onUsage = vi.fn();
    const text = "Bonjour le monde";
    const fakeClient = {
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
          }),
        },
      },
    } as unknown as OpenAI;

    await synthesizeSpeechOpenAI(fakeClient, {
      text,
      voiceId: "nova",
      onUsage,
    });

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        operation: "tts:gpt-4o-mini-tts",
        characters: text.length,
      }),
    );
  });

  it("onUsage failure does not break streamChatCompletion", async () => {
    const onUsage = vi.fn().mockRejectedValue(new Error("boom"));
    async function* fakeStream() {
      yield { choices: [{ delta: { content: "hi" } }], model: "gpt-4o-mini" };
      yield {
        choices: [{ delta: {} }],
        model: "gpt-4o-mini",
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      };
    }
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(fakeStream()),
        },
      },
    } as unknown as OpenAI;

    const out: string[] = [];
    for await (const chunk of streamChatCompletion(fakeClient, {
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-4o-mini",
      onUsage,
    })) {
      out.push(chunk);
    }
    expect(out).toEqual(["hi"]);
  });

  it("onUsage failure does not break synthesizeSpeechOpenAI", async () => {
    const onUsage = vi.fn().mockRejectedValue(new Error("boom"));
    const fakeClient = {
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
          }),
        },
      },
    } as unknown as OpenAI;

    const result = await synthesizeSpeechOpenAI(fakeClient, {
      text: "hi",
      voiceId: "nova",
      onUsage,
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(8);
  });
});

describe("TTS language forcing (wrong-language voice bug fix)", () => {
  it("builds a language-pinning instruction from a known code", () => {
    const es = ttsLanguageInstruction("es");
    expect(es).toContain("Spanish");
    expect(es).toMatch(/do NOT speak slowly/i);
    expect(ttsLanguageInstruction("it")).toContain("Italian");
  });

  it("returns undefined for missing or unknown language codes", () => {
    expect(ttsLanguageInstruction(undefined)).toBeUndefined();
    expect(ttsLanguageInstruction("zz")).toBeUndefined();
  });

  it("sends gpt-4o-mini-tts + a language instruction when languageCode is set", async () => {
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    const fakeClient = { audio: { speech: { create } } } as unknown as OpenAI;

    await synthesizeSpeechOpenAI(fakeClient, {
      text: "¿Qué es lo que más te gusta de tu trabajo?",
      voiceId: "nova",
      languageCode: "es",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("gpt-4o-mini-tts");
    expect(params.instructions).toContain("Spanish");
  });

  it("omits instructions entirely when no languageCode is given", async () => {
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    const fakeClient = { audio: { speech: { create } } } as unknown as OpenAI;

    await synthesizeSpeechOpenAI(fakeClient, { text: "hi", voiceId: "nova" });

    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("gpt-4o-mini-tts");
    expect(params.instructions).toBeUndefined();
  });
});
