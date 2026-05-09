import { describe, expect, it, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.SENTRY_DSN;
    delete process.env.PORT;
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

    const { loadEnv } = await import("./env");
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
  });
});
