import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db";

export type WeeklySummaryDeps = { db: Database };

/**
 * GET /v1/progress/weekly-summary
 *
 * Tiny aggregate over the user's conversations from the last 7 days:
 *   - session_count: conversations that have ended
 *   - total_seconds: sum of seconds_spoken across all the user's rows
 *   - languages_practiced: distinct languages used
 *
 * Backs the weekly-summary screen which the Day 7 push deep-links to.
 */
export function createWeeklySummaryRoutes(deps: WeeklySummaryDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  routes.get("/weekly-summary", async (c) => {
    const userId = c.get("userId");
    const result = (await deps.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL) AS session_count,
        COALESCE(SUM(seconds_spoken), 0)::int AS total_seconds,
        COUNT(DISTINCT language) AS languages_practiced
      FROM conversations
      WHERE user_id = ${userId}
        AND started_at >= now() - interval '7 days'
    `)) as unknown as
      | Array<{
          session_count: string | number;
          total_seconds: string | number;
          languages_practiced: string | number;
        }>
      | {
          rows: Array<{
            session_count: string | number;
            total_seconds: string | number;
            languages_practiced: string | number;
          }>;
        };

    // postgres-js drizzle adapter returns rows as an array directly, but
    // other adapters may return `{ rows: [...] }`. Handle both.
    const row =
      ("rows" in result ? result.rows?.[0] : (result as Array<unknown>)[0]) ??
      {};
    const r = row as {
      session_count?: string | number;
      total_seconds?: string | number;
      languages_practiced?: string | number;
    };

    return c.json({
      session_count: Number(r.session_count ?? 0),
      total_seconds: Number(r.total_seconds ?? 0),
      languages_practiced: Number(r.languages_practiced ?? 0),
    });
  });

  return routes;
}
