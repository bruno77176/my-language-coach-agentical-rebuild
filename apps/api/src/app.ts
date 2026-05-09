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
import { createOpenAI, streamChatCompletion } from "./providers/openai";
import { createElevenLabs, synthesizeSpeech } from "./providers/elevenlabs";
import { createStorageClient, uploadCoachAudio } from "./lib/storage";

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
  const elevenlabs = createElevenLabs(env);
  const storage = createStorageClient(env);

  app.route(
    "/v1/voice",
    createVoiceRoutes({
      db,
      transcribeAudio: (input) => transcribeAudio(deepgram, input),
      streamChatCompletion: (input) => streamChatCompletion(openai, input),
      synthesizeSpeech: (input) => synthesizeSpeech(elevenlabs, input),
      uploadCoachAudio: (input) => uploadCoachAudio(storage, input),
    }),
  );

  return app;
}
