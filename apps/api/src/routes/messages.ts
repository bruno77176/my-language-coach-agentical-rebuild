import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { messages } from "../db/schema/messages";

export type TranslateInput = { text: string; targetLanguageCode: string };
export type TranslateFn = (input: TranslateInput) => Promise<string>;

export type SynthesizeSpeechFn = (input: {
  text: string;
  voiceId: string;
}) => Promise<{ audioBuffer: Buffer; contentType: string }>;

export type UploadCoachAudioChunkFn = (input: {
  userId: string;
  conversationId: string;
  messageId: string;
  chunkIndex: number;
  audioBuffer: Buffer;
  contentType: string;
}) => Promise<{ audioUrl: string }>;

export type GetCachedAudioUrlFn = (input: {
  userId: string;
  conversationId: string;
  messageId: string;
  chunkIndex: number;
}) => Promise<string | null>;

export type MessagesDeps = {
  db: Database;
  translate: TranslateFn;
  synthesizeSpeech: SynthesizeSpeechFn;
  uploadCoachAudioChunk: UploadCoachAudioChunkFn;
  getCachedAudioUrl: GetCachedAudioUrlFn;
};

export function createMessagesRoutes(deps: MessagesDeps) {
  const app = new Hono<{ Variables: { userId: string } }>();

  app.post("/:id/translate", async (c) => {
    const messageId = c.req.param("id");
    const userId = c.get("userId");

    const message = await deps.db.query.messages.findFirst({
      where: (m, { eq: eqOp }) => eqOp(m.id, messageId),
      with: { conversation: true },
    });

    if (!message || message.conversation.userId !== userId) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    if (message.role !== "coach") {
      return c.json({ error: { code: "NOT_TRANSLATABLE" } }, 422);
    }

    if (message.translation) {
      return c.json({ translation: message.translation });
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (p, { eq: eqOp }) => eqOp(p.userId, userId),
    });
    if (!profile) {
      return c.json({ error: { code: "PROFILE_MISSING" } }, 404);
    }

    let translation: string;
    try {
      translation = await deps.translate({
        text: message.text,
        targetLanguageCode: profile.nativeLang,
      });
    } catch {
      return c.json({ error: { code: "LLM_PROVIDER_FAILURE" } }, 503);
    }

    try {
      await deps.db
        .update(messages)
        .set({ translation })
        .where(eq(messages.id, messageId));
    } catch (err) {
      // Best-effort cache write; the translation is still correct, return it.
      console.error("Failed to cache translation for message", messageId, err);
    }

    return c.json({ translation });
  });

  app.post("/:id/audio", async (c) => {
    const messageId = c.req.param("id");
    const userId = c.get("userId");

    const message = await deps.db.query.messages.findFirst({
      where: (m, { eq: e }) => e(m.id, messageId),
      with: { conversation: true },
    });

    if (!message || message.conversation.userId !== userId) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    // Try cache (chunkIndex 0 for full-message audio)
    const cached = await deps.getCachedAudioUrl({
      userId,
      conversationId: message.conversation.id,
      messageId,
      chunkIndex: 0,
    });
    if (cached) {
      return c.json({ audioUrl: cached });
    }

    let audio: { audioBuffer: Buffer; contentType: string };
    try {
      audio = await deps.synthesizeSpeech({
        text: message.text,
        voiceId: "nova",
      });
    } catch {
      return c.json({ error: { code: "TTS_PROVIDER_FAILURE" } }, 503);
    }

    const { audioUrl } = await deps.uploadCoachAudioChunk({
      userId,
      conversationId: message.conversation.id,
      messageId,
      chunkIndex: 0,
      audioBuffer: audio.audioBuffer,
      contentType: audio.contentType,
    });

    return c.json({ audioUrl });
  });

  return app;
}
