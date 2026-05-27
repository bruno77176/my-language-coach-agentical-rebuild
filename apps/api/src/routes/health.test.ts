import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Database } from "../db";

const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SECRET_KEY: "secret",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  SENTRY_DSN: "https://stub@sentry.io/1",
  OPENAI_API_KEY: "openai-stub",
  DEEPGRAM_API_KEY: "deepgram-stub",
  ELEVENLABS_API_KEY: "elevenlabs-stub",
  ADMIN_USER_IDS: "",
  ADMIN_ALLOWED_ORIGINS: "",
  INTERNAL_CRON_SECRET: "test-cron-secret-1234567890",
};

describe("GET /health", () => {
  it("returns 200 with status=ok and dbOk=true when DB ping succeeds", async () => {
    const fakeDb = { execute: vi.fn().mockResolvedValue([{ ok: 1 }]) };
    const app = createApp(baseEnv, fakeDb as unknown as Database);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; dbOk: boolean };
    expect(body.status).toBe("ok");
    expect(body.dbOk).toBe(true);
  });

  it("returns 503 with dbOk=false when DB ping fails", async () => {
    const fakeDb = {
      execute: vi.fn().mockRejectedValue(new Error("conn lost")),
    };
    const app = createApp(baseEnv, fakeDb as unknown as Database);
    const res = await app.request("/health");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; dbOk: boolean };
    expect(body.status).toBe("degraded");
    expect(body.dbOk).toBe(false);
  });
});
