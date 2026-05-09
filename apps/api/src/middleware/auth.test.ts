import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAuthMiddleware } from "./auth";

describe("authMiddleware", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = new Hono();
    const verify = vi.fn();
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when JWT verification throws", async () => {
    const app = new Hono();
    const verify = vi.fn().mockRejectedValue(new Error("bad jwt"));
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { Authorization: "Bearer bad-token" },
    });
    expect(res.status).toBe(401);
  });

  it("attaches userId to context on valid JWT and proceeds", async () => {
    const app = new Hono<{ Variables: { userId: string } }>();
    const verify = vi.fn().mockResolvedValue({ userId: "user-123" });
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ userId: c.get("userId") }));

    const res = await app.request("/", {
      headers: { Authorization: "Bearer good-token" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string };
    expect(body.userId).toBe("user-123");
  });
});
