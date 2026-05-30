import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1), // sb_publishable_... (replaces legacy "anon" key)
  SUPABASE_SECRET_KEY: z.string().min(1), // sb_secret_... (replaces legacy "service_role" key)
  DATABASE_URL: z.string().url(),
  SENTRY_DSN: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  DEEPGRAM_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  ADMIN_USER_IDS: z.string().default(""), // comma-separated Supabase user IDs
  ADMIN_ALLOWED_ORIGINS: z.string().default(""), // comma-separated origins allowed to call /admin/* (CORS)
  INTERNAL_CRON_SECRET: z.string().min(16),
  ACCOUNT_DELETION_SECRET: z.string().min(32), // 32+ random bytes hex for JWT HMAC
  RESEND_API_KEY: z.string().min(1),
  PUBLIC_WEB_BASE_URL: z.string().url(), // e.g. https://www.mylanguagecoach.app
  REVENUECAT_WEBHOOK_SECRET: z.string().min(20),
});

export type Env = z.infer<typeof EnvSchema>;

// Voice loop tuning constants — consumed by quota helper (Task 8) and turn route (Task 9).
export const FREE_TIER_VOICE_SECONDS_PER_MONTH = 30 * 60; // 30 minutes
export const FREE_TIER_VOICE_SECONDS_PER_DAY = 600; // 10 minutes — Plan 8 M4 daily cap
export const PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP = 3600; // 60 minutes — Plan 8 M4 Pro soft cap
export const MAX_TURN_AUDIO_SECONDS = 60;
export const MIN_TURN_AUDIO_SECONDS = 1;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
