import { Hono } from "hono";
import {
  RevenueCatEventSchema,
  applyRevenueCatEvent,
} from "../lib/revenuecat-webhook";
import type { Database } from "../db";

export type BillingDeps = {
  db: Database;
  webhookSecret: string;
};

export function createBillingRoutes(deps: BillingDeps) {
  const routes = new Hono();

  routes.post("/revenuecat", async (c) => {
    const auth = c.req.header("Authorization");
    if (!auth || auth !== `Bearer ${deps.webhookSecret}`) {
      return c.json({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    const raw = await c.req.json().catch(() => null);
    const parsed = RevenueCatEventSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST" } }, 400);
    }
    try {
      await applyRevenueCatEvent(deps.db, parsed.data.event);
    } catch {
      return c.json({ error: { code: "INTERNAL" } }, 500);
    }
    return c.json({ ok: true });
  });

  return routes;
}
