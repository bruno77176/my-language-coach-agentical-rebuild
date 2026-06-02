import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceRoutes } from "./voice";

function appWith(synth: ReturnType<typeof vi.fn>) {
  const routes = createVoiceRoutes({
    db: {} as never,
    transcribeAudio: vi.fn(),
    streamChatCompletion: vi.fn(),
    synthesizeSpeech: synth as never,
    uploadCoachAudioChunk: vi.fn(),
    extractMemory: vi.fn(),
    generateFeedback: vi.fn(),
  });
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
    await next();
  });
  app.route("/v1/voice", routes);
  return app;
}

describe("POST /v1/voice/preview", () => {
  it("returns base64 audio for a config + default sample text", async () => {
    const synth = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from([1, 2, 3]),
      contentType: "audio/mpeg",
    });
    const app = appWith(synth);
    const res = await app.request("/v1/voice/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        languageCode: "es",
        config: {
          provider: "openai",
          voiceId: "nova",
          speed: 1.0,
          style: "warm",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      contentType: string;
      audioBase64: string;
    };
    expect(body.contentType).toBe("audio/mpeg");
    expect(typeof body.audioBase64).toBe("string");
    expect(synth).toHaveBeenCalledWith(
      expect.objectContaining({ languageCode: "es" }),
    );
  });
});
