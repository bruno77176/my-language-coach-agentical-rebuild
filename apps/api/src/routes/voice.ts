import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
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
import { MAX_TURN_AUDIO_SECONDS, MIN_TURN_AUDIO_SECONDS } from "../env";
import { canUseSecondsDaily } from "../lib/quota";
import { ProviderError } from "../providers/deepgram";
import type { TranscribeInput, TranscribeResult } from "../providers/deepgram";
import type { StreamInput, ChatMessage } from "../providers/openai";
import type {
  SynthesizeInput,
  SynthesizeResult,
} from "../providers/elevenlabs";
import { voiceIdForLanguage } from "../providers/voice-map";
import {
  buildCoachSystemPrompt,
  parseCoachMemoryRow,
  emptyCoachMemory,
  ROLE_PLAY_SCENARIOS,
} from "@language-coach/shared";
import type { CoachMemory, SessionFeedback } from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";
import { SentenceBuffer } from "../lib/sentence-buffer";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";
import { reportError } from "../lib/sentry";

export type SynthesizeSpeechFn = (
  input: SynthesizeInput,
) => Promise<SynthesizeResult>;

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

    const inserted = await deps.db
      .insert(conversations)
      .values({
        userId,
        language: parsed.data.language,
        topicId: parsed.data.topic_id ?? null,
        scenarioId: parsed.data.scenario_id ?? null,
      })
      .returning({ id: conversations.id });

    return c.json({ conversation_id: inserted[0]!.id });
  });

  routes.post("/sessions/:id/turns", async (c) => {
    const userId = c.get("userId");
    const conversationId = c.req.param("id");
    const platform = platformFromHeader(c.req.header("X-Client-Platform"));
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

    // Quota
    const entitlement = await deps.db.query.entitlements.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    if (!entitlement) {
      return c.json(
        { error: { code: "INTERNAL", message: "No entitlement" } },
        500,
      );
    }
    const estimateSeconds = Math.ceil(audioBuffer.byteLength / 16_000);
    const dailyCheck = canUseSecondsDaily(
      {
        plan: entitlement.plan as "free" | "pro",
        proUntil: entitlement.proUntil,
        dailyVoiceSecondsUsed: entitlement.dailyVoiceSecondsUsed,
        dailyResetAt: entitlement.dailyResetAt,
      },
      estimateSeconds,
    );
    if (!dailyCheck.allowed) {
      return c.json(
        {
          error: {
            code: "DAILY_QUOTA_EXCEEDED",
            message: "Free tier daily limit reached",
            resetAt: dailyCheck.resetAt.toISOString(),
          },
        },
        429,
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

    // Load coach memory for this user × language (Plan 8 M1).
    // Consent is global (profiles.memory_enabled); when off we degrade to "no
    // memory" for every language. parseCoachMemoryRow defensively returns null
    // on corrupt data so we never crash or pass junk to the model.
    const memoryRow = await deps.db.query.coachMemory.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.languageCode, conversation.language)),
    });
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
        const promptMessages: ChatMessage[] = [
          { role: "system" as const, content: sysPrompt },
          ...history.map((m) => ({
            role: (m.role === "coach" ? "assistant" : m.role) as
              | "user"
              | "assistant"
              | "system",
            content: m.text,
          })),
        ];

        // 4. Stream GPT with per-sentence TTS
        const gptStream = deps.streamChatCompletion({
          messages: promptMessages,
          model: "gpt-4o-mini",
          onUsage,
        });

        const sentenceBuf = new SentenceBuffer();
        let chunkIndex = 0;
        const ttsPromises: Promise<void>[] = [];
        let fullCoachText = "";
        const turnSeq = Date.now(); // unique-per-turn for chunk paths
        const voiceId = voiceIdForLanguage(conversation.language);

        async function emitChunk(text: string, idx: number): Promise<void> {
          let audio: SynthesizeResult;
          try {
            audio = await deps.synthesizeSpeech({ text, voiceId, onUsage });
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
          const { audioUrl } = await deps.uploadCoachAudioChunk({
            userId,
            conversationId,
            messageId: `pending-${conversationId}-${turnSeq}`,
            chunkIndex: idx,
            audioBuffer: audio.audioBuffer,
            contentType: audio.contentType,
          });
          await stream.writeSSE({
            event: "reply-chunk",
            data: JSON.stringify({
              index: idx,
              text,
              audioUrl,
              durationMs: 0,
            }),
          });
        }

        for await (const delta of gptStream) {
          fullCoachText += delta;
          const sentences = sentenceBuf.push(delta);
          for (const s of sentences) {
            const idx = chunkIndex++;
            ttsPromises.push(emitChunk(s, idx));
          }
        }

        // Flush any remaining buffer
        const tail = sentenceBuf.flush();
        if (tail) {
          const idx = chunkIndex++;
          ttsPromises.push(emitChunk(tail, idx));
        }

        await Promise.all(ttsPromises);

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

        // 6. Update conversation seconds + entitlement (pure increments)
        const secondsThisTurn = Math.round(stt.durationSeconds);
        await deps.db
          .update(conversations)
          .set({
            secondsSpoken: (conversation.secondsSpoken ?? 0) + secondsThisTurn,
          })
          .where(eq(conversations.id, conversationId));
        await deps.db
          .update(entitlements)
          .set({
            monthlyVoiceSecondsUsed:
              entitlement.monthlyVoiceSecondsUsed + secondsThisTurn,
            dailyVoiceSecondsUsed:
              (entitlement.dailyResetAt.getTime() + 86400000 < Date.now()
                ? 0
                : entitlement.dailyVoiceSecondsUsed) + secondsThisTurn,
            dailyResetAt:
              entitlement.dailyResetAt.getTime() + 86400000 < Date.now()
                ? new Date()
                : entitlement.dailyResetAt,
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

  return routes;
}
