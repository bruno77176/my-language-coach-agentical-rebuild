import { Hono } from "hono";
import type { Database } from "../db";

export type FeedbackDeps = { db: Database };

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

  return routes;
}
