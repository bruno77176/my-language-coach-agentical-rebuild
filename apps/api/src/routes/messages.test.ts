import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createMessagesRoutes } from "./messages";

const userId = "00000000-0000-0000-0000-000000000001";
const messageId = "11111111-1111-1111-1111-111111111111";
const conversationId = "22222222-2222-2222-2222-222222222222";

function appWithMessages(routes: ReturnType<typeof createMessagesRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/messages", routes);
  return app;
}

function makeFakeDb(opts: {
  message: {
    id: string;
    role: "user" | "coach";
    text: string;
    translation: string | null;
    conversationId: string;
    conversationUserId: string;
  } | null;
  profile: { nativeLang: string } | null;
}) {
  return {
    query: {
      messages: {
        findFirst: vi.fn().mockResolvedValue(
          opts.message
            ? {
                id: opts.message.id,
                role: opts.message.role,
                text: opts.message.text,
                translation: opts.message.translation,
                conversation: {
                  id: opts.message.conversationId,
                  userId: opts.message.conversationUserId,
                },
              }
            : null,
        ),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue(opts.profile),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
}

describe("POST /v1/messages/:id/translate", () => {
  it("returns cached translation without calling LLM when present", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: "Bonjour",
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn();
    const routes = createMessagesRoutes({
      db: db as never,
      translate,
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "Bonjour" });
    expect(translate).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("calls LLM, caches, and returns translation on cache miss", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn().mockResolvedValue("Bonjour");
    const routes = createMessagesRoutes({
      db: db as never,
      translate,
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "Bonjour" });
    expect(translate).toHaveBeenCalledWith({
      text: "Buongiorno",
      targetLanguageCode: "fr",
    });
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 404 when message does not exist", async () => {
    const db = makeFakeDb({ message: null, profile: { nativeLang: "fr" } });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when message belongs to another user", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "x",
        translation: null,
        conversationId,
        conversationUserId: "99999999-9999-9999-9999-999999999999",
      },
      profile: { nativeLang: "fr" },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("returns 422 when message role is user (not coach)", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "user",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(422);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "NOT_TRANSLATABLE" },
    });
  });

  it("returns 503 when LLM fails", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn().mockRejectedValue(new Error("openai down"));
    const routes = createMessagesRoutes({
      db: db as never,
      translate,
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(503);
  });
});

describe("POST /v1/messages/:id/audio", () => {
  it("returns cached audio URL when present", async () => {
    const db = makeFakeDb({
      message: null,
      profile: { nativeLang: "fr" },
    });
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "Buongiorno",
      conversation: { id: conversationId, userId },
    });
    const synthesize = vi.fn();
    const uploadChunk = vi.fn();
    const getCachedAudioUrl = vi.fn().mockResolvedValue("https://cdn/msg.mp3");

    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: synthesize,
      uploadCoachAudioChunk: uploadChunk,
      getCachedAudioUrl,
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audioUrl: "https://cdn/msg.mp3" });
    expect(synthesize).not.toHaveBeenCalled();
    expect(uploadChunk).not.toHaveBeenCalled();
  });

  it("regenerates + uploads when no cache", async () => {
    const db = makeFakeDb({
      message: null,
      profile: { nativeLang: "fr" },
    });
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "Buongiorno",
      conversation: { id: conversationId, userId },
    });
    const synthesize = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("audio"),
      contentType: "audio/mpeg",
    });
    const uploadChunk = vi
      .fn()
      .mockResolvedValue({ audioUrl: "https://cdn/new.mp3" });

    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: synthesize,
      uploadCoachAudioChunk: uploadChunk,
      getCachedAudioUrl: vi.fn().mockResolvedValue(null),
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audioUrl: "https://cdn/new.mp3" });
    expect(synthesize).toHaveBeenCalledOnce();
    expect(uploadChunk).toHaveBeenCalledOnce();
  });

  it("returns 404 when message belongs to another user", async () => {
    const db = makeFakeDb({
      message: null,
      profile: { nativeLang: "fr" },
    });
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "x",
      conversation: {
        id: conversationId,
        userId: "99999999-9999-9999-9999-999999999999",
      },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
