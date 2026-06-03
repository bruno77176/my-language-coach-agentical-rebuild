import { describe, it, expect, vi, afterEach } from "vitest";
import { synthesizeSpeechGemini } from "./gemini";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("synthesizeSpeechGemini", () => {
  const pcmBase64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: { mimeType: "audio/L16;rate=24000", data: pcmBase64 },
            },
          ],
        },
      },
    ],
  };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when key missing", async () => {
    await expect(
      synthesizeSpeechGemini(undefined, { text: "hi", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns WAV audio on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechGemini("key", {
      text: "Hola",
      voiceId: "Kore",
      languageCode: "es",
    });
    expect(result.contentType).toBe("audio/wav");
    // 44-byte header + 4 PCM bytes
    expect(result.audioBuffer.byteLength).toBe(48);
    expect(result.audioBuffer.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("sends the voice name in speechConfig", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechGemini("key", { text: "Hola", voiceId: "Puck" });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(
      body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
        .voiceName,
    ).toBe("Puck");
    expect(body.generationConfig.responseModalities).toContain("AUDIO");
  });

  it("calls onUsage with characters", async () => {
    mockFetchOnce(okBody);
    const onUsage = vi.fn();
    await synthesizeSpeechGemini("key", {
      text: "Hola",
      voiceId: "Kore",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "gemini",
        operation: "tts:gemini-3.1-flash-tts-preview",
        characters: 4,
      }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE on non-ok response", async () => {
    mockFetchOnce({ error: "boom" }, false, 500);
    await expect(
      synthesizeSpeechGemini("key", { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
