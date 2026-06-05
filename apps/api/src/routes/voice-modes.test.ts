import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createVoiceModesRoute } from "./voice-modes";

const userId = "user-1";

function appWith(liveUserIds: string[]) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1", createVoiceModesRoute({ liveUserIds }));
  return app;
}

describe("GET /v1/voice/modes", () => {
  it("returns push-to-talk + live for an allowlisted user", async () => {
    const res = await appWith([userId]).request("/v1/voice/modes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ voiceModes: ["push_to_talk", "live"] });
  });

  it("returns only push-to-talk for a non-allowlisted user", async () => {
    const res = await appWith(["someone-else"]).request("/v1/voice/modes");
    expect(await res.json()).toEqual({ voiceModes: ["push_to_talk"] });
  });
});
