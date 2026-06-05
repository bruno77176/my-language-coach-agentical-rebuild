import { Hono } from "hono";
import { allowedVoiceModes } from "../lib/voice-entitlement";

// GET /v1/voice/modes — tells the client which voice modes this user may select,
// so the app shows the mode switcher only when more than one is available.
// Mounted behind the same auth middleware as the other /v1 routes.
export function createVoiceModesRoute(deps: { liveUserIds: string[] }) {
  const routes = new Hono<{ Variables: { userId: string } }>();
  routes.get("/voice/modes", (c) => {
    const userId = c.get("userId");
    return c.json({ voiceModes: allowedVoiceModes(userId, deps.liveUserIds) });
  });
  return routes;
}
