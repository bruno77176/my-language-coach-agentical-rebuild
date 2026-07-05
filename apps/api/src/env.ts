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
  GEMINI_API_KEY: z.string().optional(),
  // Base64-encoded service-account JSON for GA Cloud TTS (Gemini voices). GA
  // Cloud TTS rejects API keys, so we mint OAuth tokens from this. Optional:
  // when absent, the Gemini provider is unconfigured and TTS falls back to
  // OpenAI.
  GOOGLE_TTS_SA_JSON_B64: z.string().optional(),
  INWORLD_API_KEY: z.string().optional(),
  ADMIN_USER_IDS: z.string().default(""), // comma-separated Supabase user IDs
  VOICE_LIVE_USER_IDS: z.string().default(""), // comma-separated user IDs allowed to use Live voice mode
  ADMIN_ALLOWED_ORIGINS: z.string().default(""), // comma-separated origins allowed to call /admin/* (CORS)
  INTERNAL_CRON_SECRET: z.string().min(16),
  ACCOUNT_DELETION_SECRET: z.string().min(32), // 32+ random bytes hex for JWT HMAC
  RESEND_API_KEY: z.string().min(1),
  PUBLIC_WEB_BASE_URL: z.string().url(), // e.g. https://www.mylanguagecoach.app
  REVENUECAT_WEBHOOK_SECRET: z.string().min(20),
});

export type Env = z.infer<typeof EnvSchema>;

// Voice loop tuning constants — consumed by quota helper (Task 8) and turn route (Task 9).
// NOTE: the monthly cap below is legacy — `canUseSeconds` (monthly) is no longer
// enforced by any route; the daily wall-clock cap is authoritative.
export const FREE_TIER_VOICE_SECONDS_PER_MONTH = 30 * 60; // 30 minutes (legacy, unenforced)
// Free daily cap (wall-clock). "Honeymoon → squeeze" model (2026-06-26): new
// free accounts get the higher HONEYMOON cap for their first FREE_HONEYMOON_DAYS
// (build the habit + reach the "aha"), then drop to the tighter baseline so the
// daily wall bites every day and drives Pro conversion. The drop is what the
// motivated learner — your best prospect — feels.
export const FREE_TIER_VOICE_SECONDS_PER_DAY = 300; // 5 minutes — baseline free daily cap
export const FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON = 600; // 10 minutes — first days
export const FREE_HONEYMOON_DAYS = 3; // honeymoon window length (rolling, from signup)
// Pro daily cap. As of 2026-06-10 this is a HARD cap (was a soft/warn-only cap).
export const PRO_TIER_VOICE_SECONDS_PER_DAY = 3600; // 60 minutes
// Back-compat alias (older imports referenced the "soft cap" name).
export const PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP =
  PRO_TIER_VOICE_SECONDS_PER_DAY;
export const MAX_TURN_AUDIO_SECONDS = 60;
export const MIN_TURN_AUDIO_SECONDS = 1;

// Daily wall-clock cap mechanics (2026-06-10). The daily counter tracks elapsed
// *conversation* seconds (the on-screen timer), reported by the client per turn,
// not transcribed speech. The clamp bounds a tampered client and long idle gaps.
export const MAX_TURN_WALLCLOCK_DELTA_SECONDS = 180;
// Rewarded-ad "+3 min" extension (stubbed until AdMob lands): seconds granted
// back per watch, and how many watches a free user gets per local day. One per
// day — after that, only upgrading to Pro grants more access.
export const AD_EXTENSION_SECONDS = 180;
export const MAX_AD_EXTENSIONS_PER_DAY = 1;

// Continuous conversation ("infinite thread"). A per-language free-form thread
// never "ends": feedback + coach-memory + streak fire on a *checkpoint* instead
// (manual "Wrap up" or auto on inactivity). If the newest message in a thread is
// older than this when the user re-opens it, the stale segment is auto-checkpointed
// before continuing — so closing the app still earns feedback/memory/streak.
export const INACTIVITY_CHECKPOINT_MINUTES = 30;
// How many messages to return on thread open (and per "load earlier" page).
export const THREAD_HISTORY_PAGE_SIZE = 30;

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
