import { describe, it, expect, vi } from "vitest";
import { makeSynthesizeSpeech } from "./tts-router";

describe("makeSynthesizeSpeech", () => {
  const result = { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };

  it("default config (no override) routes to OpenAI with nova", async () => {
    const openai = vi.fn().mockResolvedValue(result);
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(
      {} as never,
      {} as never,
      openai,
      eleven,
    );
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
    const synth = makeSynthesizeSpeech(
      {} as never,
      {} as never,
      openai,
      eleven,
    );
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
      expect.objectContaining({ voiceId: "v1", languageCode: "it", speed: 1.1 }),
    );
  });
});
