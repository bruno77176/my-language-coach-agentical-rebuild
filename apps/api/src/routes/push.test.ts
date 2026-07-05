import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createPushRoutes } from "./push";

const userId = "00000000-0000-0000-0000-000000000001";

function appWith(routes: ReturnType<typeof createPushRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/push", routes);
  return app;
}

describe("POST /v1/push/register", () => {
  it("upserts the token and returns ok", async () => {
    let captured: { expoPushToken?: string; platform?: string } | undefined;
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn((v: { expoPushToken: string; platform: string }) => ({
          onConflictDoUpdate: vi.fn(() => {
            captured = v;
            return Promise.resolve(undefined);
          }),
        })),
      })),
    };
    const res = await appWith(createPushRoutes({ db: db as never })).request(
      "/v1/push/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expo_push_token: "ExponentPushToken[abc]",
          platform: "ios",
        }),
      },
    );
    expect(res.status).toBe(200);
    expect(captured?.expoPushToken).toBe("ExponentPushToken[abc]");
    expect(captured?.platform).toBe("ios");
  });

  it("400s when the token is missing", async () => {
    const res = await appWith(createPushRoutes({ db: {} as never })).request(
      "/v1/push/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: "ios" }),
      },
    );
    expect(res.status).toBe(400);
  });
});
