import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { quoteLikes } from "../db/schema";

export type QuoteLikesDeps = { db: Database };

/**
 * Quote "likes" (BRU-9). A user hearts a daily quote; we persist it for later
 * personalisation. quoteId is the stable kebab-case id from the shared list.
 */
export function createQuoteLikesRoutes(deps: QuoteLikesDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/quotes/likes — the ids of quotes this user has liked.
  routes.get("/likes", async (c) => {
    const userId = c.get("userId");
    const rows = await deps.db.query.quoteLikes.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    return c.json({ quoteIds: rows.map((r) => r.quoteId) });
  });

  // PUT /v1/quotes/:quoteId/like — like (idempotent).
  routes.put("/:quoteId/like", async (c) => {
    const userId = c.get("userId");
    const quoteId = c.req.param("quoteId");
    await deps.db
      .insert(quoteLikes)
      .values({ userId, quoteId })
      .onConflictDoNothing();
    return c.json({ ok: true, liked: true });
  });

  // DELETE /v1/quotes/:quoteId/like — unlike.
  routes.delete("/:quoteId/like", async (c) => {
    const userId = c.get("userId");
    const quoteId = c.req.param("quoteId");
    await deps.db
      .delete(quoteLikes)
      .where(
        and(eq(quoteLikes.userId, userId), eq(quoteLikes.quoteId, quoteId)),
      );
    return c.json({ ok: true, liked: false });
  });

  return routes;
}
