import { describe, it, expect, vi } from "vitest";
import { makeSynthesizeSpeech } from "./tts-router";

describe("makeSynthesizeSpeech", () => {
  const result = { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };
  const GEMINI_AUTH = async () => "ya29.tok";

  function deps(overrides: Record<string, unknown>) {
    return {
      openai: {} as never,
      eleven: {} as never,
      geminiAuth: GEMINI_AUTH,
      inworldKey: "ik",
      synth: overrides,
    };
  }

  it("default config routes to Gemini with Kore", async () => {
    const gemini = vi.fn().mockResolvedValue(result);
    const openai = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ gemini, openai }));
    await synth({ text: "hi", languageCode: "es" });
    expect(openai).not.toHaveBeenCalled();
    expect(gemini).toHaveBeenCalledWith(
      GEMINI_AUTH,
      expect.objectContaining({ voiceId: "Kore", languageCode: "es" }),
    );
  });

  it("elevenlabs config routes to ElevenLabs", async () => {
    const openai = vi.fn().mockResolvedValue(result);
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ openai, eleven }));
    await synth({
      text: "ciao",
      languageCode: "it",
      config: {
        provider: "elevenlabs",
        voiceId: "v1",
        speed: 1.1,
        style: "calm",
      },
    });
    expect(openai).not.toHaveBeenCalled();
    expect(eleven).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        voiceId: "v1",
        languageCode: "it",
        speed: 1.1,
      }),
    );
  });

  it("gemini config routes to Gemini with the key", async () => {
    const gemini = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ gemini }));
    await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "gemini",
        voiceId: "Kore",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(gemini).toHaveBeenCalledWith(
      GEMINI_AUTH,
      expect.objectContaining({ voiceId: "Kore", languageCode: "es" }),
    );
  });

  it("falls back to OpenAI nova when the requested provider fails", async () => {
    const gemini = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 429 RESOURCE_EXHAUSTED"));
    const openai = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ gemini, openai }));
    const out = await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "gemini",
        voiceId: "Kore",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(out).toBe(result);
    expect(gemini).toHaveBeenCalled();
    // Fallback must use a valid OpenAI voice, not the Gemini voiceId.
    expect(openai).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ voiceId: "nova", languageCode: "es" }),
    );
  });

  it("propagates the error when OpenAI itself is the failing provider (no infinite fallback)", async () => {
    const openai = vi.fn().mockRejectedValue(new Error("openai down"));
    const synth = makeSynthesizeSpeech(deps({ openai }));
    await expect(
      synth({
        text: "hi",
        config: {
          provider: "openai",
          voiceId: "nova",
          speed: 1.0,
          style: "warm",
        },
      }),
    ).rejects.toThrow("openai down");
    expect(openai).toHaveBeenCalledTimes(1);
  });

  it("inworld config routes to Inworld with the key", async () => {
    const inworld = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ inworld }));
    await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "inworld",
        voiceId: "Ashley",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(inworld).toHaveBeenCalledWith(
      "ik",
      expect.objectContaining({ voiceId: "Ashley", languageCode: "es" }),
    );
  });
});
