import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import {
  buildGreeting,
  DEFAULT_TTS_CONFIG,
  type SupportedLang,
  type TtsConfig,
} from "@language-coach/shared";
import type { Database } from "../db";
import type { OnUsage } from "../providers/usage";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";

export type SynthesizeGreetingFn = (input: {
  text: string;
  languageCode?: string;
  config?: TtsConfig;
  onUsage?: OnUsage;
}) => Promise<{ audioBuffer: Buffer; contentType: string }>;

export type UploadGreetingFn = (input: {
  lang: string;
  nameHash: string;
  voiceHash: string;
  audioBuffer: Buffer;
  contentType: string;
}) => Promise<{ audioUrl: string }>;

export type GetCachedGreetingUrlFn = (input: {
  lang: string;
  nameHash: string;
  voiceHash: string;
}) => Promise<string | null>;

export type VoiceGreetingDeps = {
  db: Database;
  synthesizeSpeech: SynthesizeGreetingFn;
  uploadGreeting: UploadGreetingFn;
  getCachedGreetingUrl: GetCachedGreetingUrlFn;
};

const ConfigSchema = z
  .object({
    provider: z.enum(["openai", "elevenlabs", "gemini", "inworld"]),
    voiceId: z.string().min(1),
    speed: z.number(),
    style: z.enum(["warm", "cheerful", "calm", "serious", "energetic"]),
  })
  .optional();

const BodySchema = z.object({
  lang: z.string().min(2),
  name: z.string().min(1),
  config: ConfigSchema,
});

function nameHashOf(name: string): string {
  return createHash("sha1")
    .update(name.toLowerCase().trim(), "utf8")
    .digest("hex")
    .slice(0, 12);
}

// Short, stable hash of the voice config so each distinct voice gets its own
// cached greeting file. Undefined config falls back to DEFAULT_TTS_CONFIG so an
// absent config and an explicit default share the same cache entry.
function voiceHashOf(config?: TtsConfig): string {
  const c = config ?? DEFAULT_TTS_CONFIG;
  return createHash("sha1")
    .update(`${c.provider}|${c.voiceId}|${c.style}|${c.speed}`, "utf8")
    .digest("hex")
    .slice(0, 10);
}

export function createVoiceGreetingRoutes(deps: VoiceGreetingDeps) {
  const app = new Hono<{ Variables: { userId: string } }>();

  app.post("/audio", async (c) => {
    const userId = c.get("userId");
    const platform = platformFromHeader(c.req.header("X-Client-Platform"));
    const parsed = BodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST" } }, 400);
    }
    const { lang, name, config } = parsed.data;
    const nameHash = nameHashOf(name);
    const voiceHash = voiceHashOf(config);

    const cached = await deps.getCachedGreetingUrl({
      lang,
      nameHash,
      voiceHash,
    });
    if (cached) {
      return c.json({ audioUrl: cached });
    }

    const text = buildGreeting(lang as SupportedLang, name);
    const onUsage = makeOnUsage(deps.db, {
      userId: userId ?? null,
      platform,
      conversationId: null,
    });

    let audio: { audioBuffer: Buffer; contentType: string };
    try {
      audio = await deps.synthesizeSpeech({
        text,
        languageCode: lang,
        config,
        onUsage,
      });
    } catch {
      return c.json({ error: { code: "TTS_PROVIDER_FAILURE" } }, 503);
    }

    const { audioUrl } = await deps.uploadGreeting({
      lang,
      nameHash,
      voiceHash,
      audioBuffer: audio.audioBuffer,
      contentType: audio.contentType,
    });

    return c.json({ audioUrl });
  });

  return app;
}
