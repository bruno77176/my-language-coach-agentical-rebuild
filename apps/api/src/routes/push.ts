import { Hono } from "hono";
import { z } from "zod";
import { pushTokens } from "../db/schema";
import type { Database } from "../db";

const RegisterBody = z.object({
  expo_push_token: z.string().min(1),
  platform: z.string().min(1).max(20),
});

// POST /v1/push/register — the mobile app registers its Expo push token here
// after the user grants notification permission. Upsert on (user_id, token) so
// reopening / re-granting is idempotent and refreshes last_seen_at. Without this
// route the push_tokens table stays empty and no notification can be delivered.
export function createPushRoutes(deps: { db: Database }) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  routes.post("/register", async (c) => {
    const userId = c.get("userId");
    const parsed = RegisterBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST" } }, 400);
    }
    await deps.db
      .insert(pushTokens)
      .values({
        userId,
        expoPushToken: parsed.data.expo_push_token,
        platform: parsed.data.platform,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.expoPushToken],
        set: { platform: parsed.data.platform, lastSeenAt: new Date() },
      });
    return c.json({ ok: true });
  });

  return routes;
}
