import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceGreetingRoutes } from "./voice-greeting";

const userId = "00000000-0000-0000-0000-000000000001";

function appWithRoutes(routes: ReturnType<typeof createVoiceGreetingRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/voice/greeting", routes);
  return app;
}

describe("POST /v1/voice/greeting/audio", () => {
  it("returns cached URL when greeting exists in storage", async () => {
    const getCached = vi
      .fn()
      .mockResolvedValue("https://cdn.test/greeting-it-abc.mp3");
    const tts = vi.fn();
    const upload = vi.fn();
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      audioUrl: "https://cdn.test/greeting-it-abc.mp3",
    });
    expect(tts).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("generates and uploads when not cached", async () => {
    const getCached = vi.fn().mockResolvedValue(null);
    const tts = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake-audio"),
      contentType: "audio/mpeg",
    });
    const upload = vi
      .fn()
      .mockResolvedValue({ audioUrl: "https://cdn.test/new.mp3" });
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      audioUrl: "https://cdn.test/new.mp3",
    });
    expect(tts).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledOnce();
  });

  it("returns 400 on missing lang or name", async () => {
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadGreeting: vi.fn(),
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 503 when TTS fails", async () => {
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: vi.fn().mockResolvedValue(null),
      synthesizeSpeech: vi.fn().mockRejectedValue(new Error("openai down")),
      uploadGreeting: vi.fn(),
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(503);
  });

  it("uses sha1-truncated nameHash so 'Bruno' and 'bruno' share cache", async () => {
    const getCached = vi.fn().mockResolvedValue(null);
    const tts = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("x"),
      contentType: "audio/mpeg",
    });
    const upload = vi.fn().mockResolvedValue({ audioUrl: "https://x" });
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);

    await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "bruno" }),
    });

    const calls = upload.mock.calls.map((c) => c[0].nameHash);
    expect(calls[0]).toBe(calls[1]);
  });
});
