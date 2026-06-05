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
  VOICE_LIVE_USER_IDS: "",
  ADMIN_ALLOWED_ORIGINS: "https://my-language-coach-admin.vercel.app",
  INTERNAL_CRON_SECRET: "test-cron-secret-1234567890",
  ACCOUNT_DELETION_SECRET:
    "0000000000000000000000000000000000000000000000000000000000000000",
  RESEND_API_KEY: "re_test_stub",
  PUBLIC_WEB_BASE_URL: "http://localhost:3002",
  REVENUECAT_WEBHOOK_SECRET: "test-revenuecat-webhook-secret-1234567890",
};

describe("CORS for /admin/*", () => {
  it("preflight from allowed origin echoes the origin in Access-Control-Allow-Origin", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/overview?from=2026-05-01&to=2026-05-31",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://my-language-coach-admin.vercel.app",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization",
        },
      },
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://my-language-coach-admin.vercel.app",
    );
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("preflight from disallowed origin does not set Access-Control-Allow-Origin", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/overview?from=2026-05-01&to=2026-05-31",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Authorization",
        },
      },
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
