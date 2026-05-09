import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db";

export function createHealthRoutes(db: Database) {
  const routes = new Hono();

  routes.get("/", async (c) => {
    let dbOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    if (!dbOk) {
      return c.json(
        { status: "degraded", dbOk, timestamp: new Date().toISOString() },
        503,
      );
    }
    return c.json({ status: "ok", dbOk, timestamp: new Date().toISOString() });
  });

  return routes;
}
