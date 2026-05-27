import { Hono } from "hono";
import type { Env } from "./env";
import type { Database } from "./db";
import { createDb } from "./db";
import { createLogger, type Logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { createLoggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/error";
import { createAuthMiddleware, type Verifier } from "./middleware/auth";
import { createSupabaseVerifier } from "./lib/supabase-verifier";
import { parseAdminIds } from "./lib/require-admin";
import { createHealthRoutes } from "./routes/health";
import { createAdminRoutes } from "./routes/admin";
import { createAdminInternalRoutes } from "./routes/admin-internal";
import { createVoiceRoutes } from "./routes/voice";
import { createDeepgram, transcribeAudio } from "./providers/deepgram";
import {
  createOpenAI,
  streamChatCompletion,
  synthesizeSpeechOpenAI,
  translateMessage,
} from "./providers/openai";
import { createMessagesRoutes } from "./routes/messages";
import { createVoiceGreetingRoutes } from "./routes/voice-greeting";
import {
  createStorageClient,
  uploadCoachAudioChunk,
  uploadGreetingAudio,
  getGreetingAudioUrl,
  getCachedCoachAudioUrl,
} from "./lib/storage";

export type AppEnv = {
  Variables: {
    env: Env;
    logger: Logger;
    db: Database;
  };
};

export function createApp(
  env: Env,
  db: Database = createDb(env),
  overrides?: { verifier?: Verifier },
) {
  const app = new Hono<AppEnv>();
  const logger = createLogger(env);
  const verifier = overrides?.verifier ?? createSupabaseVerifier(env);

  app.use("*", async (c, next) => {
    c.set("env", env);
    c.set("db", db);
    await next();
  });

  app.use("*", createLoggingMiddleware(logger));

  app.onError(errorHandler(reportError));

  app.route("/health", createHealthRoutes(db));

  // Internal admin routes called by Supabase pg_cron. MUST be mounted BEFORE
  // the general `/admin` route group so the require-admin middleware on the
  // latter doesn't intercept `/admin/internal/*` calls. Hono matches routes
  // in registration order; the more-specific path goes first.
  app.route(
    "/admin/internal",
    createAdminInternalRoutes({ db, cronSecret: env.INTERNAL_CRON_SECRET }),
  );

  // Admin routes: /admin/* requires admin via Supabase JWT + ADMIN_USER_IDS allow-list.
  // Mounted outside the /v1/* auth middleware so the admin middleware is the only auth applied.
  app.route(
    "/admin",
    createAdminRoutes({
      db,
      adminUserIds: parseAdminIds(env.ADMIN_USER_IDS),
      verifier,
    }),
  );

  // Auth-required routes: /v1/* requires a valid Supabase JWT.
  const auth = createAuthMiddleware(verifier);
  app.use("/v1/*", auth);

  const deepgram = createDeepgram(env);
  const openai = createOpenAI(env);
  const storage = createStorageClient(env);

  app.route(
    "/v1/voice",
    createVoiceRoutes({
      db,
      transcribeAudio: (input) => transcribeAudio(deepgram, input),
      streamChatCompletion: (input) => streamChatCompletion(openai, input),
      // TTS via OpenAI (ElevenLabs free + pay-as-you-go credits both block
      // library voices via API; only Creator subscription tier unlocks them).
      // Swap back to ElevenLabs by importing from ./providers/elevenlabs
      // once we're on a paid subscription.
      synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
      uploadCoachAudioChunk: (input) => uploadCoachAudioChunk(storage, input),
    }),
  );

  app.route(
    "/v1/messages",
    createMessagesRoutes({
      db,
      translate: (input) => translateMessage(openai, input),
      synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
      uploadCoachAudioChunk: (input) => uploadCoachAudioChunk(storage, input),
      getCachedAudioUrl: (input) => getCachedCoachAudioUrl(storage, input),
    }),
  );

  app.route(
    "/v1/voice/greeting",
    createVoiceGreetingRoutes({
      db,
      synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
      uploadGreeting: (input) => uploadGreetingAudio(storage, input),
      getCachedGreetingUrl: (input) => getGreetingAudioUrl(storage, input),
    }),
  );

  return app;
}
