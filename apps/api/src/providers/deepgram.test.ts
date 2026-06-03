import { describe, expect, it, vi } from "vitest";
import { deepgramModelForLanguage, transcribeAudio } from "./deepgram";

describe("transcribeAudio", () => {
  it("returns transcript text + duration on success", async () => {
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi.fn().mockResolvedValue({
              results: {
                channels: [
                  { alternatives: [{ transcript: "Hola, cómo estás?" }] },
                ],
              },
              metadata: { duration: 3.4 },
            }),
          },
        },
      },
    };
    const result = await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "es",
    });
    expect(result.text).toBe("Hola, cómo estás?");
    expect(result.durationSeconds).toBe(3.4);
  });

  it("throws STT_PROVIDER_FAILURE when Deepgram throws", async () => {
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi
              .fn()
              .mockRejectedValue(new Error("rate limited")),
          },
        },
      },
    };
    await expect(
      transcribeAudio(fakeClient as never, {
        audioBuffer: Buffer.from("x"),
        languageCode: "en",
      }),
    ).rejects.toMatchObject({ code: "STT_PROVIDER_FAILURE" });
  });

  it("calls onUsage with seconds after successful transcription", async () => {
    const onUsage = vi.fn();
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi.fn().mockResolvedValue({
              results: {
                channels: [{ alternatives: [{ transcript: "Hi" }] }],
              },
              metadata: { duration: 2.5 },
            }),
          },
        },
      },
    };
    await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "en",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "deepgram",
        operation: "transcribe:nova-3",
        seconds: 2.5,
      }),
    );
  });

  it("onUsage fires even on AUDIO_SILENT because Deepgram still bills for submitted audio", async () => {
    const onUsage = vi.fn();
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi.fn().mockResolvedValue({
              results: {
                channels: [{ alternatives: [{ transcript: "" }] }],
              },
              metadata: { duration: 1.0 },
            }),
          },
        },
      },
    };
    await expect(
      transcribeAudio(fakeClient as never, {
        audioBuffer: Buffer.from("x"),
        languageCode: "en",
        onUsage,
      }),
    ).rejects.toMatchObject({ code: "AUDIO_SILENT" });
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "deepgram",
        operation: "transcribe:nova-3",
        seconds: 1.0,
      }),
    );
  });

  it("throws AUDIO_SILENT when transcript is empty", async () => {
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi.fn().mockResolvedValue({
              results: {
                channels: [{ alternatives: [{ transcript: "   " }] }],
              },
              metadata: { duration: 5 },
            }),
          },
        },
      },
    };
    await expect(
      transcribeAudio(fakeClient as never, {
        audioBuffer: Buffer.from("x"),
        languageCode: "en",
      }),
    ).rejects.toMatchObject({ code: "AUDIO_SILENT" });
  });

  it("onUsage failure does not break transcribeAudio", async () => {
    const onUsage = vi.fn().mockRejectedValue(new Error("boom"));
    const fakeClient = {
      listen: {
        v1: {
          media: {
            transcribeFile: vi.fn().mockResolvedValue({
              results: {
                channels: [{ alternatives: [{ transcript: "Hi" }] }],
              },
              metadata: { duration: 2.5 },
            }),
          },
        },
      },
    };
    const result = await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "en",
      onUsage,
    });
    expect(result.text).toBe("Hi");
    expect(result.durationSeconds).toBe(2.5);
  });

  it("routes Chinese (zh) to nova-2 and reports it in usage", async () => {
    const transcribeFile = vi.fn().mockResolvedValue({
      results: { channels: [{ alternatives: [{ transcript: "你好" }] }] },
      metadata: { duration: 2.0 },
    });
    const onUsage = vi.fn();
    const fakeClient = { listen: { v1: { media: { transcribeFile } } } };
    await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "zh",
      onUsage,
    });
    expect(transcribeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "nova-2", language: "zh" }),
    );
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "transcribe:nova-2" }),
    );
  });

  it("keeps Japanese (ja) on nova-3", async () => {
    const transcribeFile = vi.fn().mockResolvedValue({
      results: { channels: [{ alternatives: [{ transcript: "こんにちは" }] }] },
      metadata: { duration: 2.0 },
    });
    const fakeClient = { listen: { v1: { media: { transcribeFile } } } };
    await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "ja",
    });
    expect(transcribeFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "nova-3", language: "ja" }),
    );
  });

  it("normalizes language case when selecting the model", () => {
    expect(deepgramModelForLanguage("ZH")).toBe("nova-2");
    expect(deepgramModelForLanguage("zh")).toBe("nova-2");
    expect(deepgramModelForLanguage("en")).toBe("nova-3");
  });
});
