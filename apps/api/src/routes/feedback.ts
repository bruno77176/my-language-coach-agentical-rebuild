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
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
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

  return routes;
}
