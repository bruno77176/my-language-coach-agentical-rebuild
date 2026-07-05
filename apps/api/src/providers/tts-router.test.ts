import { describe, it, expect, vi } from "vitest";
import { DEFAULT_TTS_CONFIG } from "@language-coach/shared";
import { makeSynthesizeSpeech } from "./tts-router";

describe("makeSynthesizeSpeech", () => {
  // A realistic-sized buffer (real speech audio is far larger than the
  // MIN_TTS_BYTES=256 "empty/truncated" threshold the router guards against).
  const result = {
    audioBuffer: Buffer.alloc(512, 1),
    contentType: "audio/mpeg",
  };
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

  it("falls back to the default voice for a language with no native voice", async () => {
    const eleven = vi.fn().mockResolvedValue(result);
    const openai = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ eleven, openai }));
    // "ja" (Japanese) has no dedicated native voice yet → DEFAULT_TTS_CONFIG.
    await synth({ text: "こんにちは", languageCode: "ja" });
    expect(openai).not.toHaveBeenCalled();
    // DEFAULT_TTS_CONFIG is ElevenLabs "Sarah" on Flash v2.5.
    expect(eleven).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        languageCode: "ja",
      }),
    );
  });

  it("picks the per-language native voice when no per-user config is given", async () => {
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ eleven }));
    // German → native "Lea - Clear and Feminine"; Spanish → native "Sara Martin".
    await synth({ text: "hallo", languageCode: "de" });
    await synth({ text: "hola", languageCode: "es" });
    expect(eleven).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ voiceId: "7eVMgwCnXydb3CikjV7a" }),
    );
    expect(eleven).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ voiceId: "Ir1QNHvhaJXbAGhT50w3" }),
    );
  });

  it("ignores a config equal to the default and uses the per-language voice", async () => {
    // The mobile Voice Lab sends DEFAULT_TTS_CONFIG when the user hasn't changed
    // it; that must NOT override the German native voice.
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ eleven }));
    await synth({
      text: "hallo",
      languageCode: "de",
      config: DEFAULT_TTS_CONFIG,
    });
    expect(eleven).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ voiceId: "7eVMgwCnXydb3CikjV7a" }),
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

  it("falls back to OpenAI when the provider returns empty/silent audio (no throw)", async () => {
    // ElevenLabs can close a stream with ~0 bytes on a soft limit WITHOUT
    // throwing — that must not surface as a silent coach message.
    const eleven = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.alloc(0),
      contentType: "audio/mpeg",
    });
    const openai = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ eleven, openai }));
    const out = await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "elevenlabs",
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(out).toBe(result);
    expect(eleven).toHaveBeenCalled();
    expect(openai).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ voiceId: "nova" }),
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
