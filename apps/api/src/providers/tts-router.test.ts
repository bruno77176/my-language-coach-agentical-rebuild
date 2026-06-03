import { describe, it, expect, vi } from "vitest";
import { makeSynthesizeSpeech } from "./tts-router";

describe("makeSynthesizeSpeech", () => {
  const result = { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };

  function deps(overrides: Record<string, unknown>) {
    return {
      openai: {} as never,
      eleven: {} as never,
      geminiKey: "gk",
      inworldKey: "ik",
      synth: overrides,
    };
  }

  it("default config routes to OpenAI with nova", async () => {
    const openai = vi.fn().mockResolvedValue(result);
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ openai, eleven }));
    await synth({ text: "hi", languageCode: "es" });
    expect(eleven).not.toHaveBeenCalled();
    expect(openai).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ voiceId: "nova", languageCode: "es" }),
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
      "gk",
      expect.objectContaining({ voiceId: "Kore", languageCode: "es" }),
    );
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
