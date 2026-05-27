import { describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./deepgram";

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

  it("does not fire onUsage when audio is silent", async () => {
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
    expect(onUsage).not.toHaveBeenCalled();
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
});
