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

describe("synthesizeSpeechGemini (Cloud TTS / GA gemini-2.5-flash-tts)", () => {
  const mp3Base64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = { audioContent: mp3Base64 };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when key missing", async () => {
    await expect(
      synthesizeSpeechGemini(undefined, { text: "hi", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns MP3 audio from audioContent on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechGemini("key", {
      text: "Hola",
      voiceId: "Kore",
      languageCode: "es",
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("hits the Cloud TTS endpoint with the GA model, voice name, and BCP-47 lang", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechGemini("key", {
      text: "Hallo",
      voiceId: "Puck",
      languageCode: "de",
    });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toContain("texttospeech.googleapis.com/v1/text:synthesize");
    const body = JSON.parse(call[1].body as string);
    expect(body.voice.modelName).toBe("gemini-2.5-flash-tts");
    expect(body.voice.name).toBe("Puck");
    expect(body.voice.languageCode).toBe("de-DE");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(typeof body.input.prompt).toBe("string");
    expect(body.input.text).toBe("Hallo");
  });

  it("calls onUsage with the GA model operation + characters", async () => {
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
        operation: "tts:gemini-2.5-flash-tts",
        characters: 4,
      }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE (with status) on non-ok response", async () => {
    mockFetchOnce(
      { error: { code: 403, message: "API not enabled" } },
      false,
      403,
    );
    await expect(
      synthesizeSpeechGemini("key", { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });

  it("throws TTS_PROVIDER_FAILURE when audioContent is missing", async () => {
    mockFetchOnce({});
    await expect(
      synthesizeSpeechGemini("key", { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
