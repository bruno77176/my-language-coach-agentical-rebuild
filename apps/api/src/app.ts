import { Hono } from "hono";
import type { Env } from "./env";
import type { Database } from "./db";
import { createDb } from "./db";
import { createLogger, type Logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { createLoggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/error";
import { createAuthMiddleware } from "./middleware/auth";
import { createSupabaseVerifier } from "./lib/supabase-verifier";
import { createHealthRoutes } from "./routes/health";
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
} from "./lib/storage";

export type AppEnv = {
  Variables: {
    env: Env;
    logger: Logger;
    db: Database;
  };
};

export function createApp(env: Env, db: Database = createDb(env)) {
  const app = new Hono<AppEnv>();
  const logger = createLogger(env);

  app.use("*", async (c, next) => {
    c.set("env", env);
    c.set("db", db);
    await next();
  });

  app.use("*", createLoggingMiddleware(logger));

  app.onError(errorHandler(reportError));

  app.route("/health", createHealthRoutes(db));

  // Auth-required routes: /v1/* requires a valid Supabase JWT.
  const auth = createAuthMiddleware(createSupabaseVerifier(env));
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
      getCachedAudioUrl: async () => null, // v1: always regenerate
    }),
  );

  app.route(
    "/v1/voice/greeting",
    createVoiceGreetingRoutes({
      synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
      uploadGreeting: (input) => uploadGreetingAudio(storage, input),
      getCachedGreetingUrl: (input) => getGreetingAudioUrl(storage, input),
    }),
  );

  return app;
}
