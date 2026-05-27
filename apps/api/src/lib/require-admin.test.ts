import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createRequireAdmin } from "./require-admin";

describe("requireAdmin", () => {
  const verify = vi.fn();
  const app = new Hono();
  app.use("*", createRequireAdmin({
    adminUserIds: ["admin-1", "admin-2"],
    verify,
  }));
  app.get("/secret", (c) => c.json({ ok: true }));

  it("401 when Authorization missing", async () => {
    const res = await app.request("/secret");
    expect(res.status).toBe(401);
  });

  it("403 when token valid but user not in allowlist", async () => {
    verify.mockResolvedValueOnce({ userId: "intruder" });
    const res = await app.request("/secret", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(403);
  });

  it("200 when token valid and user in allowlist", async () => {
    verify.mockResolvedValueOnce({ userId: "admin-1" });
    const res = await app.request("/secret", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
  });

  it("403 when allowlist empty (locks everything down)", async () => {
    const localApp = new Hono();
    localApp.use("*", createRequireAdmin({ adminUserIds: [], verify }));
    localApp.get("/x", (c) => c.json({ ok: true }));
    verify.mockResolvedValueOnce({ userId: "anyone" });
    const res = await localApp.request("/x", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(403);
  });
});
