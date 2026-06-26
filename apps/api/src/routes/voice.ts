import { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { eq, sql, and, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  conversations,
  messages,
  entitlements,
  coachMemory,
  sessionFeedback,
} from "../db/schema";
import type { Database } from "../db";
import {
  MAX_TURN_AUDIO_SECONDS,
  MIN_TURN_AUDIO_SECONDS,
  MAX_TURN_WALLCLOCK_DELTA_SECONDS,
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  AD_EXTENSION_SECONDS,
  MAX_AD_EXTENSIONS_PER_DAY,
} from "../env";
import { canUseSecondsDaily, dailyUsed, dailyCapSeconds } from "../lib/quota";
import { localDayKey, nextLocalMidnightUtc } from "../lib/daily-window";
import { ProviderError } from "../providers/deepgram";
import type { TranscribeInput, TranscribeResult } from "../providers/deepgram";
import type { StreamInput, ChatMessage } from "../providers/openai";
import type { TtsResult } from "../providers/openai";
import type { RoutedTtsInput } from "../providers/tts-router";
import { parseTtsConfig } from "../providers/tts-config";
import {
  buildCoachSystemPrompt,
  parseCoachMemoryRow,
  emptyCoachMemory,
  ROLE_PLAY_SCENARIOS,
  getOpeningLine,
  buildGreeting,
  GREETING_TEMPLATES,
} from "@language-coach/shared";
import type {
  CoachMemory,
  SessionFeedback,
  TtsConfig,
  SupportedLang,
} from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";
import { runTurn } from "./run-turn";
import { persistVocab } from "./vocab-persist";
import { SentenceBuffer } from "../lib/sentence-buffer";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";
import { reportError } from "../lib/sentry";

export type SynthesizeSpeechFn = (input: RoutedTtsInput) => Promise<TtsResult>;

export type UploadCoachAudioChunkFn = (input: {
  userId: string;
  conversationId: string;
  messageId: string;
  chunkIndex: number;
  audioBuffer: Buffer;
  contentType: string;
}) => Promise<{ audioUrl: string }>;

export type ExtractMemoryFn = (input: {
  existingMemory: CoachMemory;
  transcript: Array<{ role: "user" | "coach"; text: string }>;
  languageCode: string;
  onUsage?: OnUsage;
}) => Promise<CoachMemory | null>;

export type GenerateFeedbackFn = (input: {
  transcript: Array<{ role: "user" | "coach"; text: string }>;
  languageCode: string;
  nativeLanguageCode: string;
  onUsage?: OnUsage;
}) => Promise<SessionFeedback | null>;

export type VoiceDeps = {
  db: Database;
  transcribeAudio: (input: TranscribeInput) => Promise<TranscribeResult>;
  streamChatCompletion: (input: StreamInput) => AsyncGenerator<string>;
  synthesizeSpeech: SynthesizeSpeechFn;
  uploadCoachAudioChunk: UploadCoachAudioChunkFn;
  extractMemory: ExtractMemoryFn;
  generateFeedback: GenerateFeedbackFn;
};

const StartSessionBody = z.object({
  language: z.string().min(2).max(8),
  topic_id: z.string().uuid().optional(),
  scenario_id: z
    .enum(ROLE_PLAY_SCENARIOS.map((s) => s.id) as [string, ...string[]])
    .optional(),
});

// Quick byte-size guards before we even hit the STT provider. These are loose
// upper/lower bounds based on a typical PCM/Opus/MP3 encoding at speech bit
// rates; the authoritative duration check happens after STT returns
// metadata.duration.
const MAX_AUDIO_BYTES = 1_500_000; // ~60s of mp3 @ 192kbps
const MIN_AUDIO_BYTES = 4_000; // ~< 1s of speech in any reasonable codec

// Cap how many prior messages we forward to the LLM each turn. Sending the
// full unbounded history bloats the prompt → higher time-to-first-token and
// cost as a conversation grows. Older context is preserved via coach memory
// (the rolling summary injected into the system prompt). ~20 messages ≈ the
// last 10 exchanges.
const MAX_HISTORY_MESSAGES = 20;

// Build-23+ clients send `X-Client-Capabilities: inline-audio` to opt into
// receiving coach audio bytes inline (base64) in the reply-chunk event,
// playing them immediately instead of fetching a signed Storage URL. This
// removes a Storage upload + signed-URL round-trip on the server AND the
// client re-download from the latency-critical path. Older builds omit the
// header and keep the legacy signed-URL path, so installed clients still work.
function clientSupportsInlineAudio(header: string | undefined): boolean {
  return (header ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes("inline-audio");
}

// Emit one coach audio chunk over SSE, choosing the inline-base64 path or the
// legacy signed-URL path based on the client's advertised capability. The
// upload thunk is only invoked on the legacy path, so inline clients never
// touch Storage.
async function writeReplyChunk(
  stream: SSEStreamingApi,
  opts: {
    index: number;
    text: string;
    audio: TtsResult;
    inlineAudio: boolean;
    upload: () => Promise<{ audioUrl: string }>;
  },
): Promise<void> {
  if (opts.inlineAudio) {
    await stream.writeSSE({
      event: "reply-chunk",
      data: JSON.stringify({
        index: opts.index,
        text: opts.text,
        audioBase64: opts.audio.audioBuffer.toString("base64"),
        contentType: opts.audio.contentType,
        durationMs: 0,
      }),
    });
    return;
  }
  const { audioUrl } = await opts.upload();
  await stream.writeSSE({
    event: "reply-chunk",
    data: JSON.stringify({
      index: opts.index,
      text: opts.text,
      audioUrl,
      durationMs: 0,
    }),
  });
}

export function createVoiceRoutes(deps: VoiceDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/voice/sessions/recent — Plan 8 follow-up: chooser screen
  // shows the user's last 5 completed sessions with feedback status so
  // they can review past coaching reports.
  routes.get("/sessions/recent", async (c) => {
    const userId = c.get("userId");
    const rows = await deps.db
      .select({
        id: conversations.id,
        language: conversations.language,
        scenarioId: conversations.scenarioId,
        startedAt: conversations.startedAt,
        endedAt: conversations.endedAt,
        secondsSpoken: conversations.secondsSpoken,
        feedbackStatus: sessionFeedback.status,
      })
      .from(conversations)
      .leftJoin(
        sessionFeedback,
        eq(sessionFeedback.conversationId, conversations.id),
      )
      .where(
        and(eq(conversations.userId, userId), isNotNull(conversations.endedAt)),
      )
      .orderBy(desc(conversations.endedAt))
      .limit(5);
    return c.json({ sessions: rows });
  });

  routes.post("/sessions", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = StartSessionBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }

    // Daily wall-clock gate on session start — a capped user never even opens a
    // conversation (or triggers a free greeting). Same check as the turn route.
    const [entitlement, profile] = await Promise.all([
      deps.db.query.entitlements.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
      deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
    ]);
    const tz = profile?.timezone ?? "UTC";
    const now = new Date();
    if (entitlement) {
      const check = canUseSecondsDaily(
        {
          plan: entitlement.plan as "free" | "pro",
          proUntil: entitlement.proUntil,
          dailyVoiceSecondsUsed: entitlement.dailyVoiceSecondsUsed,
          dailyResetAt: entitlement.dailyResetAt,
          accountCreatedAt: profile?.createdAt ?? null,
        },
        tz,
        now,
      );
      if (!check.allowed) {
        return c.json(
          {
            error: {
              code: "DAILY_QUOTA_EXCEEDED",
              message: "Daily limit reached",
              resetAt: check.resetAt.toISOString(),
            },
          },
          429,
        );
      }
    }

    const inserted = await deps.db
      .insert(conversations)
      .values({
        userId,
        language: parsed.data.language,
        topicId: parsed.data.topic_id ?? null,
        scenarioId: parsed.data.scenario_id ?? null,
      })
      .returning({ id: conversations.id });

    // Surface the current budget so the client can enforce the cap locally
    // (stop the session timer) and show an accurate countdown.
    const used = entitlement ? dailyUsed(entitlement, tz, now) : 0;
    const cap = entitlement
      ? dailyCapSeconds(
          {
            plan: entitlement.plan as "free" | "pro",
            proUntil: entitlement.proUntil,
            accountCreatedAt: profile?.createdAt ?? null,
          },
          now,
        )
      : FREE_TIER_VOICE_SECONDS_PER_DAY;
    // Rewarded-ad extensions left today (1/day) so the limit screen can keep
    // the "watch an ad" button disabled across remounts, not just within one.
    const extSameDay =
      entitlement != null &&
      localDayKey(entitlement.dailyResetAt, tz) === localDayKey(now, tz);
    const extUsedToday = extSameDay ? entitlement.dailyAdExtensions : 0;
    return c.json({
      conversation_id: inserted[0]!.id,
      daily_used_seconds: used,
      daily_cap_seconds: cap,
      reset_at: nextLocalMidnightUtc(now, tz).toISOString(),
      ad_extensions_remaining: Math.max(
        0,
        MAX_AD_EXTENSIONS_PER_DAY - extUsedToday,
      ),
    });
  });

  // POST /ad-extension — grant a "+3 min" rewarded-ad extension. STUB: no ad
  // verification yet (the client calls this after a simulated watch); real
  // AdMob server-side verification lands in a later milestone. Subtracts
  // AD_EXTENSION_SECONDS from today's used budget, capped at
  // MAX_AD_EXTENSIONS_PER_DAY per local day.
  routes.post("/ad-extension", async (c) => {
    const userId = c.get("userId");
    const [entitlement, profile] = await Promise.all([
      deps.db.query.entitlements.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
      deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
    ]);
    if (!entitlement) {
      return c.json(
        { error: { code: "INTERNAL", message: "No entitlement" } },
        500,
      );
    }
    const tz = profile?.timezone ?? "UTC";
    const now = new Date();
    const sameDay =
      localDayKey(entitlement.dailyResetAt, tz) === localDayKey(now, tz);
    const usedToday = sameDay ? entitlement.dailyVoiceSecondsUsed : 0;
    const extToday = sameDay ? entitlement.dailyAdExtensions : 0;
    if (extToday >= MAX_AD_EXTENSIONS_PER_DAY) {
      return c.json(
        {
          error: {
            code: "AD_LIMIT_REACHED",
            message: "No more ad extensions today",
          },
        },
        409,
      );
    }
    const newUsed = Math.max(0, usedToday - AD_EXTENSION_SECONDS);
    await deps.db
      .update(entitlements)
      .set({
        dailyVoiceSecondsUsed: newUsed,
        dailyAdExtensions: extToday + 1,
        dailyResetAt: sameDay ? entitlement.dailyResetAt : now,
      })
      .where(eq(entitlements.userId, userId));
    return c.json({
      daily_used_seconds: newUsed,
      daily_cap_seconds: dailyCapSeconds(
        {
          plan: entitlement.plan as "free" | "pro",
          proUntil: entitlement.proUntil,
          accountCreatedAt: profile?.createdAt ?? null,
        },
        now,
      ),
      reset_at: nextLocalMidnightUtc(now, tz).toISOString(),
      extensions_remaining: MAX_AD_EXTENSIONS_PER_DAY - (extToday + 1),
    });
  });

  routes.post("/sessions/:id/turns", async (c) => {
    const userId = c.get("userId");
    const conversationId = c.req.param("id");
    const platform = platformFromHeader(c.req.header("X-Client-Platform"));
    const inlineAudio = clientSupportsInlineAudio(
      c.req.header("X-Client-Capabilities"),
    );
    const onUsage = makeOnUsage(deps.db, {
      userId,
      platform,
      conversationId,
    });

    // Load conversation + verify ownership.
    const conversation = await deps.db.query.conversations.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, conversationId), e(t.userId, userId)),
    });
    if (!conversation) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        404,
      );
    }

    // Multipart audio body
    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("audio");
    if (!(file instanceof File)) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Missing audio" } },
        400,
      );
    }
    const audioBuffer = Buffer.from(await file.arrayBuffer());

    // Quick size guards
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return c.json(
        { error: { code: "AUDIO_TOO_LONG", message: "Max 60s" } },
        413,
      );
    }
    if (audioBuffer.byteLength < MIN_AUDIO_BYTES) {
      return c.json(
        { error: { code: "AUDIO_TOO_SHORT", message: "Min 1s" } },
        422,
      );
    }

    // Fetch the three independent per-turn reads concurrently. These were
    // previously three serial DB round-trips on the request hot path; the
    // coach-memory row only depends on userId + language (already known from
    // the conversation), so it's safe to load alongside entitlement + profile.
    const [entitlement, profile, memoryRow] = await Promise.all([
      deps.db.query.entitlements.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
      deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      }),
      // Consent is global (profiles.memory_enabled); when off we degrade to
      // "no memory" below. parseCoachMemoryRow defensively returns null on
      // corrupt data so we never crash or pass junk to the model.
      deps.db.query.coachMemory.findFirst({
        where: (t, { eq: e, and: a }) =>
          a(e(t.userId, userId), e(t.languageCode, conversation.language)),
      }),
    ]);

    // Quota
    if (!entitlement) {
      return c.json(
        { error: { code: "INTERNAL", message: "No entitlement" } },
        500,
      );
    }
    // Daily wall-clock gate: block once the budget is already spent. The
    // in-flight turn's elapsed time is accumulated after a successful turn.
    const tz = profile?.timezone ?? "UTC";
    const dailyCheck = canUseSecondsDaily(
      {
        plan: entitlement.plan as "free" | "pro",
        proUntil: entitlement.proUntil,
        dailyVoiceSecondsUsed: entitlement.dailyVoiceSecondsUsed,
        dailyResetAt: entitlement.dailyResetAt,
      },
      tz,
    );
    if (!dailyCheck.allowed) {
      return c.json(
        {
          error: {
            code: "DAILY_QUOTA_EXCEEDED",
            message: "Daily limit reached",
            resetAt: dailyCheck.resetAt.toISOString(),
          },
        },
        429,
      );
    }

    if (!profile) {
      return c.json(
        { error: { code: "INTERNAL", message: "No profile" } },
        500,
      );
    }
    const memory =
      memoryRow && profile.memoryEnabled
        ? parseCoachMemoryRow(memoryRow)
        : null;
    const memoryDepth =
      entitlement.plan === "pro" &&
      entitlement.proUntil &&
      entitlement.proUntil > new Date()
        ? ("deep" as const)
        : ("basic" as const);

    return streamSSE(c, async (stream) => {
      try {
        // 1. Transcribe
        const stt = await deps.transcribeAudio({
          audioBuffer,
          languageCode: conversation.language,
          onUsage,
        });
        await stream.writeSSE({
          event: "transcription",
          data: JSON.stringify({ text: stt.text }),
        });

        // Bounds on actual duration
        if (stt.durationSeconds > MAX_TURN_AUDIO_SECONDS) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              code: "AUDIO_TOO_LONG",
              message: "Max 60s",
              retryable: false,
            }),
          });
          return;
        }
        if (stt.durationSeconds < MIN_TURN_AUDIO_SECONDS) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              code: "AUDIO_TOO_SHORT",
              message: "Min 1s",
              retryable: true,
            }),
          });
          return;
        }

        // 2. Insert user message
        const userMsgRows = await deps.db
          .insert(messages)
          .values({ conversationId, role: "user", text: stt.text })
          .returning({ id: messages.id });
        const userMsgId = userMsgRows[0]!.id;

        // 3. Build prompt + history
        const history = await deps.db.query.messages.findMany({
          where: (t, { eq: e }) => e(t.conversationId, conversationId),
          orderBy: (t, { asc: a }) => [a(t.createdAt)],
        });
        const scenario = conversation.scenarioId
          ? (ROLE_PLAY_SCENARIOS.find(
              (s) => s.id === conversation.scenarioId,
            ) ?? null)
          : null;
        const scenarioFragment = scenario
          ? {
              id: scenario.id,
              systemPromptFragment: scenario.systemPromptFragment,
            }
          : null;
        const sysPrompt = buildCoachSystemPrompt({
          targetLanguage: conversation.language,
          userDisplayName: profile.displayName,
          memory,
          memoryDepth,
          scenario: scenarioFragment,
        });
        const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
        const promptMessages: ChatMessage[] = [
          { role: "system" as const, content: sysPrompt },
          ...recentHistory.map((m) => ({
            role: (m.role === "coach" ? "assistant" : m.role) as
              | "user"
              | "assistant"
              | "system",
            content: m.text,
          })),
        ];

        // 4. Stream GPT with per-sentence TTS. The LLM→sentence→TTS loop lives
        // in runTurn (shared with the Live WS route); transport-specific
        // delivery (inline base64 vs signed-URL upload) stays here in onChunk.
        const turnSeq = Date.now(); // unique-per-turn for chunk paths
        const languageCode = conversation.language;
        // Optional per-turn voice override from the dev Voice Lab; junk →
        // undefined so the router falls back to DEFAULT_TTS_CONFIG (production
        // behavior). Auth is already enforced by the /v1 middleware.
        const voiceConfigRaw = formData?.get("voice_config");
        let voiceConfig: TtsConfig | undefined;
        if (typeof voiceConfigRaw === "string") {
          try {
            voiceConfig = parseTtsConfig(JSON.parse(voiceConfigRaw));
          } catch {
            voiceConfig = undefined;
          }
        }

        const { fullText: fullCoachText } = await runTurn(
          {
            streamChatCompletion: deps.streamChatCompletion,
            synthesizeSpeech: deps.synthesizeSpeech,
          },
          {
            messages: promptMessages,
            languageCode,
            ttsConfig: voiceConfig,
            model: "gpt-4o-mini",
            onUsage,
          },
          async ({ index, text, audio }) => {
            await writeReplyChunk(stream, {
              index,
              text,
              audio,
              inlineAudio,
              upload: () =>
                deps.uploadCoachAudioChunk({
                  userId,
                  conversationId,
                  messageId: `pending-${conversationId}-${turnSeq}`,
                  chunkIndex: index,
                  audioBuffer: audio.audioBuffer,
                  contentType: audio.contentType,
                }),
            });
          },
          async (index) => {
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({
                code: "TTS_PROVIDER_FAILURE",
                message: "TTS failed for chunk " + index,
                retryable: true,
              }),
            });
          },
        );

        // 5. Insert the full coach message (single row, full text)
        const [coachRow] = await deps.db
          .insert(messages)
          .values({
            conversationId,
            role: "coach",
            text: fullCoachText,
            audioStoragePath: null,
          })
          .returning();

        const coachMsgId = coachRow!.id;

        // 6. Update counters.
        //  - conversation.secondsSpoken + monthlyVoiceSecondsUsed track actual
        //    transcribed *speech* seconds (cost analytics; monthly is vestigial).
        //  - dailyVoiceSecondsUsed tracks elapsed *conversation* wall-clock time
        //    (the on-screen timer), reported by the client per turn and clamped
        //    against tampering / long idle gaps. Resets at local midnight.
        const speechSeconds = Math.round(stt.durationSeconds);
        const elapsedRaw = Number(formData?.get("elapsed_delta_seconds") ?? 0);
        const wallclockDelta = Number.isFinite(elapsedRaw)
          ? Math.min(
              MAX_TURN_WALLCLOCK_DELTA_SECONDS,
              Math.max(0, Math.round(elapsedRaw)),
            )
          : 0;
        const turnNow = new Date();
        const sameDay =
          localDayKey(entitlement.dailyResetAt, tz) ===
          localDayKey(turnNow, tz);
        await deps.db
          .update(conversations)
          .set({
            secondsSpoken: (conversation.secondsSpoken ?? 0) + speechSeconds,
          })
          .where(eq(conversations.id, conversationId));
        await deps.db
          .update(entitlements)
          .set({
            monthlyVoiceSecondsUsed:
              entitlement.monthlyVoiceSecondsUsed + speechSeconds,
            dailyVoiceSecondsUsed:
              (sameDay ? entitlement.dailyVoiceSecondsUsed : 0) +
              wallclockDelta,
            dailyResetAt: sameDay ? entitlement.dailyResetAt : turnNow,
          })
          .where(eq(entitlements.userId, userId));

        // 7. Done event
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            messageId: coachMsgId,
            userMessageId: userMsgId,
          }),
        });
      } catch (err) {
        const code = err instanceof ProviderError ? err.code : "INTERNAL";
        const message = (err as Error).message ?? "Unexpected error";
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            code,
            message,
            retryable: code !== "QUOTA_EXCEEDED",
          }),
        });
      }
    });
  });

  // POST /sessions/:id/opening — scenario-only coach opener. The coach speaks
  // the first line in character. This turn is FREE: no transcription, no quota
  // check, no usage/seconds counting. Reuses the reply-chunk → TTS pipeline.
  routes.post("/sessions/:id/opening", async (c) => {
    const userId = c.get("userId");
    const conversationId = c.req.param("id");
    const platform = platformFromHeader(c.req.header("X-Client-Platform"));
    const onUsage = makeOnUsage(deps.db, { userId, platform, conversationId });

    const conversation = await deps.db.query.conversations.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, conversationId), e(t.userId, userId)),
    });
    if (!conversation) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        404,
      );
    }
    if (!conversation.scenarioId) {
      return c.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Opening is only available for scenarios",
          },
        },
        400,
      );
    }
    const scenario = ROLE_PLAY_SCENARIOS.find(
      (s) => s.id === conversation.scenarioId,
    );
    if (!scenario) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Unknown scenario" } },
        400,
      );
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    if (!profile) {
      return c.json(
        { error: { code: "INTERNAL", message: "No profile" } },
        500,
      );
    }

    // Idempotency: if this conversation already has messages, the opener was
    // already produced (double mount / retry). Emit done without regenerating.
    const existing = await deps.db.query.messages.findMany({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
      orderBy: (t, { asc: a }) => [a(t.createdAt)],
    });
    if (existing.length > 0) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            messageId: existing[existing.length - 1]?.id ?? "",
          }),
        });
      });
    }

    const languageCode = conversation.language;
    // Prefer the saved, deterministic opener so the line appears instantly and
    // we skip the LLM round-trip. Falls back to live generation if a scenario
    // has no saved line for this language.
    const savedOpener = getOpeningLine(scenario.id, languageCode);
    const inlineAudio = clientSupportsInlineAudio(
      c.req.header("X-Client-Capabilities"),
    );

    return streamSSE(c, async (stream) => {
      try {
        const sentenceBuf = new SentenceBuffer();
        let chunkIndex = 0;
        const ttsPromises: Promise<void>[] = [];
        let fullCoachText = "";
        const turnSeq = Date.now();

        async function emitChunk(text: string, idx: number): Promise<void> {
          let audio: TtsResult;
          try {
            audio = await deps.synthesizeSpeech({
              text,
              languageCode,
              onUsage,
            });
          } catch {
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({
                code: "TTS_PROVIDER_FAILURE",
                message: "TTS failed for chunk " + idx,
                retryable: true,
              }),
            });
            return;
          }
          await writeReplyChunk(stream, {
            index: idx,
            text,
            audio,
            inlineAudio,
            upload: () =>
              deps.uploadCoachAudioChunk({
                userId,
                conversationId,
                messageId: `pending-${conversationId}-${turnSeq}`,
                chunkIndex: idx,
                audioBuffer: audio.audioBuffer,
                contentType: audio.contentType,
              }),
          });
        }

        if (savedOpener) {
          // Deterministic saved opener: one chunk, no LLM. Fast and free.
          fullCoachText = savedOpener;
          await emitChunk(savedOpener, chunkIndex++);
        } else {
          // No saved line for this scenario/language — generate the opener
          // live. System-only context: the model produces the opener because
          // there is no prior user turn.
          const sysPrompt = buildCoachSystemPrompt({
            targetLanguage: conversation.language,
            userDisplayName: profile.displayName,
            memory: null,
            scenario: {
              id: scenario.id,
              systemPromptFragment: scenario.systemPromptFragment,
            },
          });
          const gptStream = deps.streamChatCompletion({
            messages: [{ role: "system" as const, content: sysPrompt }],
            model: "gpt-4o-mini",
            onUsage,
          });
          for await (const delta of gptStream) {
            fullCoachText += delta;
            const sentences = sentenceBuf.push(delta);
            for (const s of sentences) {
              const idx = chunkIndex++;
              ttsPromises.push(emitChunk(s, idx));
            }
          }
          const tail = sentenceBuf.flush();
          if (tail) {
            const idx = chunkIndex++;
            ttsPromises.push(emitChunk(tail, idx));
          }
          await Promise.all(ttsPromises);
        }

        const [coachRow] = await deps.db
          .insert(messages)
          .values({
            conversationId,
            role: "coach",
            text: fullCoachText,
            audioStoragePath: null,
          })
          .returning();

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ messageId: coachRow!.id }),
        });
      } catch (err) {
        const code = err instanceof ProviderError ? err.code : "INTERNAL";
        const message = (err as Error).message ?? "Unexpected error";
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            code,
            message,
            retryable: code !== "QUOTA_EXCEEDED",
          }),
        });
      }
    });
  });

  routes.post("/sessions/:id/end", async (c) => {
    const userId = c.get("userId");
    const conversationId = c.req.param("id");

    const conversation = await deps.db.query.conversations.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, conversationId), e(t.userId, userId)),
    });
    if (!conversation) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        404,
      );
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    if (!profile) {
      return c.json(
        { error: { code: "INTERNAL", message: "No profile" } },
        500,
      );
    }

    // Idempotent: if already ended, return current state without re-counting.
    if (conversation.endedAt) {
      return c.json({
        seconds_spoken: conversation.secondsSpoken ?? 0,
        goal_reached: false,
      });
    }

    // Practice time = wall-clock session duration (started_at → now). This
    // is what users intuitively expect ("I spent 5 minutes practicing")
    // rather than the Deepgram-measured speaking time (which would be ~1 min
    // out of a 5-min session). Trade-off: gameable if you leave the screen
    // open without talking; acceptable for v1.
    const endedAt = new Date();
    const startedAtMs = new Date(conversation.startedAt).getTime();
    const sessionDurationSec = Math.max(
      0,
      Math.floor((endedAt.getTime() - startedAtMs) / 1000),
    );

    await deps.db
      .update(conversations)
      .set({ endedAt, secondsSpoken: sessionDurationSec })
      .where(eq(conversations.id, conversationId));

    // Compute today's date in user's local TZ (e.g. "2026-05-09").
    const todayInTz = new Intl.DateTimeFormat("en-CA", {
      timeZone: profile.timezone,
    }).format(new Date());

    const dailyGoalSeconds = profile.dailyGoalMinutes * 60;
    const goalReached = sessionDurationSec >= dailyGoalSeconds;

    // Upsert streak_days for today: add this session's duration, OR-set
    // goal_reached.
    await deps.db.execute(sql`
      INSERT INTO streak_days (user_id, date, seconds_spoken, goal_reached)
      VALUES (${userId}, ${todayInTz}, ${sessionDurationSec}, ${goalReached})
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        seconds_spoken = streak_days.seconds_spoken + ${sessionDurationSec},
        goal_reached = streak_days.goal_reached OR (streak_days.seconds_spoken + ${sessionDurationSec} >= ${dailyGoalSeconds})
    `);

    // Plan 8 M5: schedule Day 1/2/7 push notifications on the first session end.
    // scheduleOnboardingPushes is idempotent: it skips if a day-1-feedback row
    // already exists for this user, so this is safe to run on every /end call.
    void (async () => {
      try {
        const { scheduleOnboardingPushes } =
          await import("../lib/push-scheduler");
        await scheduleOnboardingPushes(deps.db, userId, profile.timezone);
      } catch {
        // Idempotent + isolated; failures swallowed
      }
    })();

    // Plan 8 M1: fire-and-forget memory extraction. Never block the response.
    void (async () => {
      try {
        // Global consent gate: skip extraction entirely when memory is off.
        if (!profile.memoryEnabled) return;
        const memoryRow = await deps.db.query.coachMemory.findFirst({
          where: (t, { eq: e, and: a }) =>
            a(e(t.userId, userId), e(t.languageCode, conversation.language)),
        });
        const existingMemory =
          parseCoachMemoryRow(memoryRow) ?? emptyCoachMemory();
        const transcript = await deps.db.query.messages.findMany({
          where: (t, { eq: e }) => e(t.conversationId, conversationId),
          orderBy: (t, { asc: a }) => [a(t.createdAt)],
        });
        const ttranscript = transcript.map((m) => ({
          role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
          text: m.text,
        }));
        const onUsage = makeOnUsage(deps.db, {
          userId,
          platform: platformFromHeader(c.req.header("X-Client-Platform")),
          conversationId,
        });
        const updated = await deps.extractMemory({
          existingMemory,
          transcript: ttranscript,
          languageCode: conversation.language,
          onUsage,
        });
        if (!updated) return; // parse failure already handled inside extractMemory
        await deps.db
          .insert(coachMemory)
          .values({
            userId,
            languageCode: conversation.language,
            proficiencyLevel: updated.proficiency_level ?? null,
            recentTopics: updated.recent_topics,
            weakAreas: updated.weak_areas,
            personalContext: updated.personal_context,
            lastSessionSummary: updated.last_session_summary ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [coachMemory.userId, coachMemory.languageCode],
            set: {
              proficiencyLevel: updated.proficiency_level ?? null,
              recentTopics: updated.recent_topics,
              weakAreas: updated.weak_areas,
              personalContext: updated.personal_context,
              lastSessionSummary: updated.last_session_summary ?? null,
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        // Memory extraction never breaks the user-visible flow, but we still
        // want failures surfaced in Sentry so silent regressions are visible.
        reportError(err, {
          where: "voice.end.memory-extract",
          userId,
          conversationId,
        });
      }
    })();

    // Plan 8 M2: insert pending feedback row, then fire gen job. Fire-and-forget.
    void (async () => {
      try {
        await deps.db
          .insert(sessionFeedback)
          .values({
            conversationId,
            status: "pending",
            highlights: [],
            corrections: [],
            vocab: [],
          })
          .onConflictDoNothing();

        const transcript = await deps.db.query.messages.findMany({
          where: (t, { eq: e }) => e(t.conversationId, conversationId),
          orderBy: (t, { asc: a }) => [a(t.createdAt)],
        });
        const ttranscript = transcript.map((m) => ({
          role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
          text: m.text,
        }));
        const onUsage = makeOnUsage(deps.db, {
          userId,
          platform: platformFromHeader(c.req.header("X-Client-Platform")),
          conversationId,
        });
        const fb = await deps.generateFeedback({
          transcript: ttranscript,
          languageCode: conversation.language,
          nativeLanguageCode: profile.nativeLang,
          onUsage,
        });
        if (!fb) {
          await deps.db
            .update(sessionFeedback)
            .set({ status: "failed" })
            .where(eq(sessionFeedback.conversationId, conversationId));
          return;
        }
        await deps.db
          .update(sessionFeedback)
          .set({
            status: "ready",
            highlights: fb.highlights,
            corrections: fb.corrections,
            vocab: fb.vocab,
          })
          .where(eq(sessionFeedback.conversationId, conversationId));

        // Mirror the extracted vocab into the persistent flashcard deck.
        await persistVocab(deps.db, {
          userId,
          language: conversation.language,
          vocab: fb.vocab,
        });
      } catch {
        // Already reported via reportError inside generate-feedback;
        // outer catch swallows DB errors so /end response isn't blocked.
      }
    })();

    return c.json({
      seconds_spoken: sessionDurationSec,
      goal_reached: goalReached,
    });
  });

  // Dev voice-lab preview: synthesize a short sample in any config. No quota
  // (dev tool); auth still required via the /v1 middleware. The sample text is
  // the app's localized greeting so the preview is actually IN the chosen
  // language for all 12 supported langs (not just a hardcoded few).
  routes.post("/preview", async (c) => {
    const body = await c.req
      .json()
      .catch(() => ({}) as Record<string, unknown>);
    const languageCode =
      typeof body.languageCode === "string" ? body.languageCode : "en";
    const config = parseTtsConfig(body.config);
    const sampleLang: SupportedLang =
      languageCode in GREETING_TEMPLATES
        ? (languageCode as SupportedLang)
        : "en";
    const text =
      typeof body.text === "string" && body.text.trim()
        ? body.text
        : buildGreeting(sampleLang, "Alex");
    try {
      const audio = await deps.synthesizeSpeech({ text, languageCode, config });
      return c.json({
        audioBase64: audio.audioBuffer.toString("base64"),
        contentType: audio.contentType,
      });
    } catch (err) {
      const message = (err as Error).message ?? "TTS failed";
      return c.json({ error: { code: "TTS_PROVIDER_FAILURE", message } }, 503);
    }
  });

  return routes;
}
