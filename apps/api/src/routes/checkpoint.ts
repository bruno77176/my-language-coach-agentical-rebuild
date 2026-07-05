import { eq, and, gt, isNull, sql } from "drizzle-orm";
import {
  messages,
  sessionFeedback,
  coachMemory,
  digestJobs,
  sessionCheckpoints,
} from "../db/schema";
import type { Database } from "../db";
import { parseCoachMemoryRow, emptyCoachMemory } from "@language-coach/shared";
import { makeOnUsage } from "../lib/usage-bridge";
import { persistVocab } from "./vocab-persist";
import { reportError } from "../lib/sentry";
// Type-only import (no runtime cycle) — the concrete fns come in via deps.
import type { ExtractMemoryFn, GenerateFeedbackFn } from "./voice";

// Shared "checkpoint" side-effects: streak accounting, coach-memory extraction,
// and end-of-segment feedback. Historically these fired only on POST
// /sessions/:id/end (one conversation = one session). With continuous threads a
// conversation never ends, so the same work now runs per *segment* — bounded by
// `since` (the previous checkpoint's ended_at) and keyed on a `checkpointId`
// instead of the conversation. Scenario/legacy /end calls pass `since=null`
// (whole conversation) and `checkpointId=null` (key on conversation_id), which
// reproduces the original behavior exactly.

/**
 * Upsert today's streak_days row (add seconds, OR-set goal_reached). Awaited by
 * callers because it's cheap and its completion is expected before the HTTP
 * response, mirroring the original /end behavior. Returns whether this segment
 * alone met the daily goal.
 */
export async function upsertStreakDay(
  db: Database,
  args: {
    userId: string;
    timezone: string;
    secondsSpoken: number;
    dailyGoalMinutes: number;
    now: Date;
  },
): Promise<{ goalReached: boolean }> {
  const todayInTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: args.timezone,
  }).format(args.now);
  const dailyGoalSeconds = args.dailyGoalMinutes * 60;
  const segmentGoalReached = args.secondsSpoken >= dailyGoalSeconds;
  const res = await db.execute(sql`
    INSERT INTO streak_days (user_id, date, seconds_spoken, goal_reached)
    VALUES (${args.userId}, ${todayInTz}, ${args.secondsSpoken}, ${segmentGoalReached})
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      seconds_spoken = streak_days.seconds_spoken + ${args.secondsSpoken},
      goal_reached = streak_days.goal_reached OR (streak_days.seconds_spoken + ${args.secondsSpoken} >= ${dailyGoalSeconds})
    RETURNING goal_reached
  `);
  // Report the CUMULATIVE day goal (several short segments can add up to it),
  // not just this segment. Fall back to the per-segment value if the driver's
  // result shape is unavailable (e.g. in unit tests with a stubbed execute).
  const rows = Array.isArray(res)
    ? (res as Array<{ goal_reached?: boolean }>)
    : ((res as { rows?: Array<{ goal_reached?: boolean }> })?.rows ?? []);
  const goalReached = rows[0]?.goal_reached ?? segmentGoalReached;
  return { goalReached };
}

export type FeedbackMemoryDeps = {
  extractMemory: ExtractMemoryFn;
  generateFeedback: GenerateFeedbackFn;
};

export type RunFeedbackAndMemoryInput = {
  db: Database;
  deps: FeedbackMemoryDeps;
  userId: string;
  conversationId: string;
  language: string;
  nativeLang: string;
  memoryEnabled: boolean;
  /** As returned by platformFromHeader ('ios'|'android'|'web'|'server'|'unknown'). */
  platform: string;
  /** Segment lower bound (exclusive). null = whole conversation. */
  since: Date | null;
  /** Set → thread checkpoint (key feedback/digest on it). null → scenario/legacy (key on conversation). */
  checkpointId: string | null;
};

/**
 * Extract coach memory + generate feedback for the message range
 * `(since, now]` of a conversation. Fire-and-forget from routes (never blocks
 * the response); every failure is swallowed after Sentry reporting so it can't
 * break the user-visible flow.
 */
export async function runFeedbackAndMemory(
  input: RunFeedbackAndMemoryInput,
): Promise<void> {
  const {
    db,
    deps,
    userId,
    conversationId,
    language,
    nativeLang,
    memoryEnabled,
    platform,
    since,
    checkpointId,
  } = input;

  const rangeWhere = since
    ? and(
        eq(messages.conversationId, conversationId),
        gt(messages.createdAt, since),
      )
    : eq(messages.conversationId, conversationId);

  // 1. Coach-memory extraction (consent-gated), scoped to the segment.
  void (async () => {
    try {
      if (!memoryEnabled) return;
      const memoryRow = await db.query.coachMemory.findFirst({
        where: (t, { eq: e, and: a }) =>
          a(e(t.userId, userId), e(t.languageCode, language)),
      });
      const existingMemory =
        parseCoachMemoryRow(memoryRow) ?? emptyCoachMemory();
      const transcript = await db.query.messages.findMany({
        where: rangeWhere,
        orderBy: (t, { asc: a }) => [a(t.createdAt)],
      });
      if (transcript.length === 0) return;
      const ttranscript = transcript.map((m) => ({
        role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
        text: m.text,
      }));
      const onUsage = makeOnUsage(db, { userId, platform, conversationId });
      const updated = await deps.extractMemory({
        existingMemory,
        transcript: ttranscript,
        languageCode: language,
        onUsage,
      });
      if (!updated) return;
      await db
        .insert(coachMemory)
        .values({
          userId,
          languageCode: language,
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
      reportError(err, {
        where: "checkpoint.memory-extract",
        userId,
        conversationId,
      });
    }
  })();

  // 2. Between-session digest (Pro): cheap row insert; worker gates + does the
  // work. Keyed on checkpoint for threads, conversation for scenario/legacy.
  if (memoryEnabled) {
    void (async () => {
      try {
        await db
          .insert(digestJobs)
          .values({
            userId,
            conversationId,
            checkpointId,
            languageCode: language,
          })
          .onConflictDoNothing();
      } catch (err) {
        reportError(err, {
          where: "checkpoint.digest-enqueue",
          userId,
          conversationId,
        });
      }
    })();
  }

  // 3. Feedback: insert a pending row, generate, then update. Keyed on
  // checkpoint (thread) or conversation (scenario/legacy).
  void (async () => {
    try {
      await db
        .insert(sessionFeedback)
        .values({
          conversationId,
          checkpointId,
          status: "pending",
          highlights: [],
          corrections: [],
          vocab: [],
        })
        .onConflictDoNothing();

      const transcript = await db.query.messages.findMany({
        where: rangeWhere,
        orderBy: (t, { asc: a }) => [a(t.createdAt)],
      });
      const ttranscript = transcript.map((m) => ({
        role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
        text: m.text,
      }));
      const onUsage = makeOnUsage(db, { userId, platform, conversationId });
      const fb = await deps.generateFeedback({
        transcript: ttranscript,
        languageCode: language,
        nativeLanguageCode: nativeLang,
        onUsage,
      });
      // Match the exact row we just inserted (thread → checkpoint_id; legacy →
      // conversation_id with checkpoint_id NULL).
      const feedbackWhere = checkpointId
        ? eq(sessionFeedback.checkpointId, checkpointId)
        : and(
            eq(sessionFeedback.conversationId, conversationId),
            isNull(sessionFeedback.checkpointId),
          );
      if (!fb) {
        await db
          .update(sessionFeedback)
          .set({ status: "failed" })
          .where(feedbackWhere);
        return;
      }
      await db
        .update(sessionFeedback)
        .set({
          status: "ready",
          highlights: fb.highlights,
          corrections: fb.corrections,
          vocab: fb.vocab,
        })
        .where(feedbackWhere);

      await persistVocab(db, { userId, language, vocab: fb.vocab });
    } catch (err) {
      reportError(err, {
        where: "checkpoint.feedback",
        userId,
        conversationId,
      });
    }
  })();
}

export type MaybeCheckpointArgs = {
  db: Database;
  deps: FeedbackMemoryDeps;
  conversation: {
    id: string;
    userId: string;
    language: string;
    startedAt: Date;
  };
  profile: {
    timezone: string;
    dailyGoalMinutes: number;
    memoryEnabled: boolean;
    nativeLang: string;
  };
  platform: string;
  now: Date;
  /** force=true → checkpoint whenever un-checkpointed messages exist (manual wrap-up).
   *  force=false → only when the newest message is older than inactivityMs (auto). */
  force: boolean;
  inactivityMs: number;
};

/**
 * Close the current open segment of a thread into a checkpoint, if warranted.
 * Returns null when there's nothing to checkpoint (no new messages, or not yet
 * stale for the auto path). Otherwise inserts a session_checkpoints row, updates
 * the streak, and fires feedback + memory for the segment (fire-and-forget).
 */
export async function maybeCheckpoint(args: MaybeCheckpointArgs): Promise<{
  checkpointId: string;
  secondsSpoken: number;
  goalReached: boolean;
} | null> {
  const {
    db,
    deps,
    conversation,
    profile,
    platform,
    now,
    force,
    inactivityMs,
  } = args;

  const last = await db.query.sessionCheckpoints.findFirst({
    where: (t, { eq: e }) => e(t.conversationId, conversation.id),
    orderBy: (t, { desc: d }) => [d(t.endedAt)],
  });
  const since = last?.endedAt ?? conversation.startedAt;

  // Newest un-checkpointed message (segment upper bound = last activity).
  const newest = await db.query.messages.findFirst({
    where: (t, { eq: e, and: a, gt: g }) =>
      a(e(t.conversationId, conversation.id), g(t.createdAt, since)),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  if (!newest) return null; // nothing new since the last checkpoint

  const newestAt = new Date(newest.createdAt);
  if (!force && now.getTime() - newestAt.getTime() <= inactivityMs) {
    return null; // segment still active — don't auto-checkpoint yet
  }

  const sinceDate = new Date(since);
  // Count practice as first→last activity in the segment, not wall-clock-to-now,
  // so a long idle gap before an auto-checkpoint doesn't inflate the streak.
  const secondsSpoken = Math.max(
    0,
    Math.floor((newestAt.getTime() - sinceDate.getTime()) / 1000),
  );

  const inserted = await db
    .insert(sessionCheckpoints)
    .values({
      conversationId: conversation.id,
      userId: conversation.userId,
      language: conversation.language,
      startedAt: sinceDate,
      endedAt: newestAt,
      secondsSpoken,
    })
    // Idempotent per segment (unique on conversation_id + started_at): a
    // concurrent checkpoint of the same open segment loses here and bails, so
    // streak/feedback/digest never double-fire.
    .onConflictDoNothing({
      target: [sessionCheckpoints.conversationId, sessionCheckpoints.startedAt],
    })
    .returning({ id: sessionCheckpoints.id });
  if (inserted.length === 0) {
    return null; // another checkpoint already closed this segment
  }
  const checkpointId = inserted[0]!.id;

  const { goalReached } = await upsertStreakDay(db, {
    userId: conversation.userId,
    timezone: profile.timezone,
    secondsSpoken,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    now: newestAt,
  });

  // Schedule onboarding pushes on the user's first completed segment. Free-form
  // threads reach this path (not /end), so without it a thread-only user would
  // never get the day-1/2/7 pushes. Idempotent — skips if already scheduled.
  void (async () => {
    try {
      const { scheduleOnboardingPushes } =
        await import("./../lib/push-scheduler");
      await scheduleOnboardingPushes(db, conversation.userId, profile.timezone);
    } catch {
      // idempotent + isolated; failures swallowed
    }
  })();

  void runFeedbackAndMemory({
    db,
    deps,
    userId: conversation.userId,
    conversationId: conversation.id,
    language: conversation.language,
    nativeLang: profile.nativeLang,
    memoryEnabled: profile.memoryEnabled,
    platform,
    since: sinceDate,
    checkpointId,
  });

  return { checkpointId, secondsSpoken, goalReached };
}
