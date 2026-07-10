import { Hono } from "hono";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { Database } from "../db";
import { messages, sessionFeedback } from "../db/schema";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";
import { persistVocab } from "./vocab-persist";
import { reportError } from "../lib/sentry";
import type { GenerateFeedbackFn } from "./voice";

export type FeedbackDeps = {
  db: Database;
  generateFeedback: GenerateFeedbackFn;
};

type RegenerateArgs = {
  db: Database;
  generateFeedback: GenerateFeedbackFn;
  userId: string;
  conversationId: string;
  /** Set → thread checkpoint row; null → scenario/legacy row (checkpoint_id NULL). */
  checkpointId: string | null;
  language: string;
  nativeLang: string;
  platform: string;
  /** Message window to summarize. null = the whole conversation (scenario/legacy). */
  range: { start: Date; end: Date } | null;
};

/**
 * Re-run feedback generation for one already-`failed` segment and update its row
 * in place. Used by the "Try again" retry endpoints. Regenerates ONLY the report
 * (no coach-memory extraction, no digest — those aren't the failure). Best-effort:
 * every error is reported and swallowed, leaving the row `failed`.
 */
export async function regenerateFeedback(args: RegenerateArgs): Promise<void> {
  const {
    db,
    generateFeedback,
    userId,
    conversationId,
    checkpointId,
    language,
    nativeLang,
    platform,
    range,
  } = args;

  // Match the exact row (thread → checkpoint_id; scenario/legacy →
  // conversation_id with checkpoint_id NULL).
  const feedbackWhere = checkpointId
    ? eq(sessionFeedback.checkpointId, checkpointId)
    : and(
        eq(sessionFeedback.conversationId, conversationId),
        isNull(sessionFeedback.checkpointId),
      );

  try {
    // For a checkpoint, bound the transcript to the ORIGINAL segment window so a
    // retry days later reproduces the same sitting, not newer thread messages.
    const rangeWhere = range
      ? and(
          eq(messages.conversationId, conversationId),
          gte(messages.createdAt, range.start),
          lte(messages.createdAt, range.end),
        )
      : eq(messages.conversationId, conversationId);
    const transcript = await db.query.messages.findMany({
      where: rangeWhere,
      orderBy: (t, { asc: a }) => [a(t.createdAt)],
    });
    const ttranscript = transcript.map((m) => ({
      role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
      text: m.text,
    }));
    const onUsage = makeOnUsage(db, { userId, platform, conversationId });
    const fb = await generateFeedback({
      transcript: ttranscript,
      languageCode: language,
      nativeLanguageCode: nativeLang,
      onUsage,
    });
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
    reportError(err, { where: "feedback.retry", userId, conversationId });
    // Leave the row `failed` so the UI can offer "Try again" once more.
    try {
      await db
        .update(sessionFeedback)
        .set({ status: "failed" })
        .where(feedbackWhere);
    } catch {
      // swallow — nothing more we can do
    }
  }
}

export function createFeedbackRoutes(deps: FeedbackDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/sessions/:id/feedback
  routes.get("/sessions/:id/feedback", async (c) => {
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
    // A continuous thread has one feedback row per checkpoint (all sharing the
    // thread's conversation_id). Return the most recent — i.e. the segment the
    // user just wrapped up. Scenario/legacy conversations have a single row, so
    // the ordering is a no-op there.
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
      orderBy: (t, { desc: d }) => [d(t.createdAt)],
    });
    if (!row) {
      return c.json({ status: "missing" }); // /end wasn't called yet
    }
    return c.json({
      status: row.status,
      highlights: row.highlights,
      corrections: row.corrections,
      vocab: row.vocab,
    });
  });

  // GET /v1/checkpoints/:id/feedback — feedback for one continuous-thread
  // segment (a specific checkpoint), ownership-checked.
  routes.get("/checkpoints/:id/feedback", async (c) => {
    const userId = c.get("userId");
    const checkpointId = c.req.param("id");
    const cp = await deps.db.query.sessionCheckpoints.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, checkpointId), e(t.userId, userId)),
    });
    if (!cp) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Checkpoint not found" } },
        404,
      );
    }
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e }) => e(t.checkpointId, checkpointId),
    });
    if (!row) {
      return c.json({ status: "missing" });
    }
    return c.json({
      status: row.status,
      highlights: row.highlights,
      corrections: row.corrections,
      vocab: row.vocab,
    });
  });

  // POST /v1/sessions/:id/feedback/retry — regenerate a FAILED scenario/legacy
  // report (checkpoint_id NULL). 202 + background regen; the client polls the
  // GET route (which resumes on `pending`).
  routes.post("/sessions/:id/feedback/retry", async (c) => {
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
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e, and: a, isNull: n }) =>
        a(e(t.conversationId, conversationId), n(t.checkpointId)),
    });
    if (!row) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No feedback to retry" } },
        404,
      );
    }
    if (row.status === "ready") {
      return c.json({
        status: "ready",
        highlights: row.highlights,
        corrections: row.corrections,
        vocab: row.vocab,
      });
    }
    if (row.status === "pending") {
      return c.json({ status: "pending" }, 202); // already in flight
    }

    // status === "failed" → flip to pending, then regenerate in the background.
    const flipped = await deps.db
      .update(sessionFeedback)
      .set({ status: "pending" })
      .where(
        and(
          eq(sessionFeedback.conversationId, conversationId),
          isNull(sessionFeedback.checkpointId),
        ),
      )
      .returning({ status: sessionFeedback.status });
    if (flipped.length === 0) {
      // Lost a race (another retry/checkpoint touched it); nothing to do.
      return c.json({ status: row.status }, 202);
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    void regenerateFeedback({
      db: deps.db,
      generateFeedback: deps.generateFeedback,
      userId,
      conversationId,
      checkpointId: null,
      language: conversation.language,
      nativeLang: profile?.nativeLang ?? "en",
      platform: platformFromHeader(c.req.header("X-Client-Platform")),
      range: null, // whole conversation (scenario/legacy)
    });
    return c.json({ status: "pending" }, 202);
  });

  // POST /v1/checkpoints/:id/feedback/retry — regenerate a FAILED thread-segment
  // report, bounded to the checkpoint's original [startedAt, endedAt] window.
  routes.post("/checkpoints/:id/feedback/retry", async (c) => {
    const userId = c.get("userId");
    const checkpointId = c.req.param("id");
    const cp = await deps.db.query.sessionCheckpoints.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, checkpointId), e(t.userId, userId)),
    });
    if (!cp) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Checkpoint not found" } },
        404,
      );
    }
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e }) => e(t.checkpointId, checkpointId),
    });
    if (!row) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "No feedback to retry" } },
        404,
      );
    }
    if (row.status === "ready") {
      return c.json({
        status: "ready",
        highlights: row.highlights,
        corrections: row.corrections,
        vocab: row.vocab,
      });
    }
    if (row.status === "pending") {
      return c.json({ status: "pending" }, 202);
    }

    const flipped = await deps.db
      .update(sessionFeedback)
      .set({ status: "pending" })
      .where(eq(sessionFeedback.checkpointId, checkpointId))
      .returning({ status: sessionFeedback.status });
    if (flipped.length === 0) {
      return c.json({ status: row.status }, 202);
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    void regenerateFeedback({
      db: deps.db,
      generateFeedback: deps.generateFeedback,
      userId,
      conversationId: cp.conversationId,
      checkpointId,
      language: cp.language,
      nativeLang: profile?.nativeLang ?? "en",
      platform: platformFromHeader(c.req.header("X-Client-Platform")),
      range: { start: cp.startedAt, end: cp.endedAt },
    });
    return c.json({ status: "pending" }, 202);
  });

  return routes;
}
