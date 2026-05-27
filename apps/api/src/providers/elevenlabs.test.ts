import { describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "./elevenlabs";

describe("synthesizeSpeech", () => {
  it("returns audio buffer + content type", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    async function* fakeStream() {
      yield fakeAudio;
    }
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockResolvedValue(fakeStream()),
      },
    };
    const result = await synthesizeSpeech(fakeClient as never, {
      text: "Bonjour",
      voiceId: "voice-fr",
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("calls onUsage with characters after successful synth", async () => {
    const onUsage = vi.fn();
    async function* fakeStream() {
      yield new Uint8Array([1, 2, 3]);
    }
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockResolvedValue(fakeStream()),
      },
    };
    const text = "Bonjour";
    await synthesizeSpeech(fakeClient as never, {
      text,
      voiceId: "voice-fr",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "elevenlabs",
        operation: "tts:eleven_flash_v2_5",
        characters: text.length,
      }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE on error", async () => {
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockRejectedValue(new Error("quota")),
      },
    };
    await expect(
      synthesizeSpeech(fakeClient as never, { text: "x", voiceId: "v" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });

  it("onUsage failure does not break synthesizeSpeech", async () => {
    const onUsage = vi.fn().mockRejectedValue(new Error("boom"));
    async function* fakeStream() {
      yield new Uint8Array([1, 2, 3]);
    }
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockResolvedValue(fakeStream()),
      },
    };
    const result = await synthesizeSpeech(fakeClient as never, {
      text: "Bonjour",
      voiceId: "voice-fr",
      onUsage,
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(3);
  });
});
