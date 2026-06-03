import { describe, it, expect, vi, afterEach } from "vitest";
import { synthesizeSpeechInworld } from "./inworld";

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

describe("synthesizeSpeechInworld", () => {
  const mp3Base64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = { audioContent: mp3Base64 };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when key missing", async () => {
    await expect(
      synthesizeSpeechInworld(undefined, { text: "hi", voiceId: "Ashley" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns MP3 audio on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Ashley",
      speed: 1.1,
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("sends voiceId, model and speakingRate", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Olivia",
      speed: 0.9,
    });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(body.voiceId).toBe("Olivia");
    expect(body.modelId).toBe("inworld-tts-1.5-max");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(body.audioConfig.speakingRate).toBeCloseTo(0.9);
    expect(call[1].headers.authorization).toMatch(/^Basic /);
  });

  it("calls onUsage with characters", async () => {
    mockFetchOnce(okBody);
    const onUsage = vi.fn();
    await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Ashley",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "inworld",
        operation: "tts:inworld-tts-1.5-max",
        characters: 4,
      }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE on non-ok response", async () => {
    mockFetchOnce({ error: "boom" }, false, 401);
    await expect(
      synthesizeSpeechInworld("key", { text: "x", voiceId: "Ashley" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
