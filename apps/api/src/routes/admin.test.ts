import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Database } from "../db";

const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "p",
  SUPABASE_SECRET_KEY: "s",
  DATABASE_URL: "postgres://u:p@localhost:5432/d",
  SENTRY_DSN: "https://stub@sentry.io/1",
  OPENAI_API_KEY: "o",
  DEEPGRAM_API_KEY: "d",
  ELEVENLABS_API_KEY: "e",
  ADMIN_USER_IDS: "admin-1",
};

describe("GET /admin/overview", () => {
  it("403 for non-admin", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "not-admin" }),
    });
    const res = await app.request("/admin/overview?from=2026-05-01&to=2026-05-31", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(403);
  });

  it("returns aggregates for admin", async () => {
    const fakeDb = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          { variable_cost: "10", active_users: 2, event_count: 8 },
        ])
        .mockResolvedValueOnce([]) // fixed
        .mockResolvedValueOnce([]), // upfront
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/overview?from=2026-05-01&to=2026-05-31",
      { headers: { Authorization: "Bearer t" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalCostUsd: number };
    expect(body.totalCostUsd).toBeCloseTo(10, 2);
  });
});

describe("GET /admin/by-service", () => {
  it("returns service breakdown", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([
        { service: "openai", cost: "8", units: "1000", event_count: 5 },
      ]),
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/by-service?from=2026-05-01&to=2026-05-31",
      { headers: { Authorization: "Bearer t" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ service: string }>;
    expect(body[0]?.service).toBe("openai");
  });
});

describe("GET /admin/auth/me", () => {
  it("returns isAdmin=true for admin user", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/auth/me", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isAdmin: boolean; userId: string };
    expect(body.isAdmin).toBe(true);
    expect(body.userId).toBe("admin-1");
  });
});
