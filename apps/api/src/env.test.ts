import { describe, expect, it, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.SENTRY_DSN;
    delete process.env.PORT;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.INTERNAL_CRON_SECRET;
    delete process.env.ADMIN_ALLOWED_ORIGINS;
    delete process.env.ACCOUNT_DELETION_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.PUBLIC_WEB_BASE_URL;
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
  });

  it("throws a clear error when required vars are missing", async () => {
    await expect(async () => {
      const { loadEnv } = await import("./env");
      loadEnv();
    }).rejects.toThrow(/SUPABASE_URL/);
  });

  it("returns a validated env object when all vars are present", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key-stub";
    process.env.SUPABASE_SECRET_KEY = "secret-key-stub";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.SENTRY_DSN = "https://stub@sentry.io/1";
    process.env.PORT = "4000";
    process.env.OPENAI_API_KEY = "openai-key-stub";
    process.env.DEEPGRAM_API_KEY = "deepgram-key-stub";
    process.env.ELEVENLABS_API_KEY = "elevenlabs-key-stub";
    process.env.INTERNAL_CRON_SECRET = "test-cron-secret-1234567890";
    process.env.ACCOUNT_DELETION_SECRET = "0".repeat(64);
    process.env.RESEND_API_KEY = "re_test_stub";
    process.env.PUBLIC_WEB_BASE_URL = "http://localhost:3002";
    process.env.REVENUECAT_WEBHOOK_SECRET =
      "test-revenuecat-webhook-secret-1234567890";

    const { loadEnv } = await import("./env");
    const env = loadEnv();
    expect(env.SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.PORT).toBe(4000);
  });

  it("defaults PORT to 3000 if not set", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key-stub";
    process.env.SUPABASE_SECRET_KEY = "secret-key-stub";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.SENTRY_DSN = "https://stub@sentry.io/1";
    process.env.OPENAI_API_KEY = "openai-key-stub";
    process.env.DEEPGRAM_API_KEY = "deepgram-key-stub";
    process.env.ELEVENLABS_API_KEY = "elevenlabs-key-stub";
    process.env.INTERNAL_CRON_SECRET = "test-cron-secret-1234567890";
    process.env.ACCOUNT_DELETION_SECRET = "0".repeat(64);
    process.env.RESEND_API_KEY = "re_test_stub";
    process.env.PUBLIC_WEB_BASE_URL = "http://localhost:3002";
    process.env.REVENUECAT_WEBHOOK_SECRET =
      "test-revenuecat-webhook-secret-1234567890";

    const { loadEnv } = await import("./env");
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
  });

  it("requires OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key-stub";
    process.env.SUPABASE_SECRET_KEY = "secret-key-stub";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.SENTRY_DSN = "https://stub@sentry.io/1";
    // intentionally NOT setting the new provider keys
    await expect(async () => {
      const { loadEnv } = await import("./env");
      loadEnv();
    }).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
