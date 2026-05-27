import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db";

/**
 * Internal endpoints called by Supabase pg_cron (or any other internal
 * scheduler). Authenticates via a shared secret in the `X-Cron-Secret`
 * header — NOT via Supabase JWT — so they're mounted under `/admin/internal/*`
 * BEFORE the general `/admin/*` route group in `app.ts`.
 *
 * Bruno must schedule the cron job manually via the Supabase SQL editor —
 * see `apps/api/src/db/cron-setup.sql` for the SQL to paste.
 */
export function createAdminInternalRoutes(deps: {
  db: Database;
  cronSecret: string;
}) {
  const routes = new Hono();

  routes.use("*", async (c, next) => {
    if (c.req.header("X-Cron-Secret") !== deps.cronSecret) {
      return c.json({ error: { code: "FORBIDDEN" } }, 403);
    }
    await next();
  });

  routes.post("/refresh-views", async (c) => {
    await deps.db.execute(
      sql`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_cost_by_user`,
    );
    return c.json({ ok: true, refreshedAt: new Date().toISOString() });
  });

  return routes;
}
