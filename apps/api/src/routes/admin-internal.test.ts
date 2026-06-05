import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Database } from "../db";

const env = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://t.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "p",
  SUPABASE_SECRET_KEY: "s",
  DATABASE_URL: "postgres://u:p@localhost:5432/d",
  SENTRY_DSN: "https://stub@sentry.io/1",
  OPENAI_API_KEY: "o",
  DEEPGRAM_API_KEY: "d",
  ELEVENLABS_API_KEY: "e",
  ADMIN_USER_IDS: "",
  VOICE_LIVE_USER_IDS: "",
  ADMIN_ALLOWED_ORIGINS: "",
  INTERNAL_CRON_SECRET: "super-secret-cron-token-1234",
  ACCOUNT_DELETION_SECRET:
    "0000000000000000000000000000000000000000000000000000000000000000",
  RESEND_API_KEY: "re_test_stub",
  PUBLIC_WEB_BASE_URL: "http://localhost:3002",
  REVENUECAT_WEBHOOK_SECRET: "test-revenuecat-webhook-secret-1234567890",
};

// Helper for inspecting Drizzle SQL objects passed to db.execute.
// Drizzle SQL objects expose interleaved static-string chunks and param values
// via `queryChunks`. Flatten to a single inspectable string.
function flattenSql(call: unknown): string {
  const sqlObj = call as {
    queryChunks?: Array<{ value?: string[] } | unknown>;
  };
  if (!sqlObj.queryChunks) return String(call);
  return sqlObj.queryChunks
    .map((c) => {
      if (c && typeof c === "object" && "value" in c) {
        return (c as { value: string[] }).value.join("");
      }
      return String(c);
    })
    .join("|");
}

describe("POST /admin/internal/refresh-views", () => {
  it("403 without secret", async () => {
    const db = { execute: vi.fn() } as unknown as Database;
    const app = createApp(env, db);
    const res = await app.request("/admin/internal/refresh-views", {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  it("200 with correct secret and runs REFRESH", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const db = { execute } as unknown as Database;
    const app = createApp(env, db);
    const res = await app.request("/admin/internal/refresh-views", {
      method: "POST",
      headers: { "X-Cron-Secret": env.INTERNAL_CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const sqlText = flattenSql(execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("REFRESH MATERIALIZED VIEW");
    expect(sqlText).toContain("daily_cost_by_user");
  });
});
