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

const token = async () => "ya29.test-access-token";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("synthesizeSpeechGemini (Cloud TTS / GA gemini-2.5-flash-tts, OAuth)", () => {
  const mp3Base64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = { audioContent: mp3Base64 };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when no token provider", async () => {
    await expect(
      synthesizeSpeechGemini(undefined, { text: "hi", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns MP3 audio from audioContent on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechGemini(token, {
      text: "Hola",
      voiceId: "Kore",
      languageCode: "es",
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("sends a Bearer token and hits the Cloud TTS endpoint with the GA model", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechGemini(token, {
      text: "Hallo",
      voiceId: "Puck",
      languageCode: "de",
    });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
    );
    expect(call[1].headers.authorization).toBe("Bearer ya29.test-access-token");
    const body = JSON.parse(call[1].body as string);
    expect(body.voice.modelName).toBe("gemini-2.5-flash-tts");
    expect(body.voice.name).toBe("Puck");
    expect(body.voice.languageCode).toBe("de-DE");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(body.input.text).toBe("Hallo");
  });

  it("wraps a token-mint failure as TTS_PROVIDER_FAILURE", async () => {
    const failingToken = async () => {
      throw new Error("token exchange 400");
    };
    await expect(
      synthesizeSpeechGemini(failingToken, { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });

  it("calls onUsage with the GA model operation + characters", async () => {
    mockFetchOnce(okBody);
    const onUsage = vi.fn();
    await synthesizeSpeechGemini(token, {
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
      synthesizeSpeechGemini(token, { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });

  it("throws TTS_PROVIDER_FAILURE when audioContent is missing", async () => {
    mockFetchOnce({});
    await expect(
      synthesizeSpeechGemini(token, { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
