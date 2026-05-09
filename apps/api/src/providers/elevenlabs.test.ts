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
});
