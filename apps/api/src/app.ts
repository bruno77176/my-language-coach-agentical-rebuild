import { Hono } from "hono";
import { cors } from "hono/cors";
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
import { createMemoryRoutes } from "./routes/memory";
import { createFeedbackRoutes } from "./routes/feedback";
import { createVoiceGreetingRoutes } from "./routes/voice-greeting";
import {
  createStorageClient,
  uploadCoachAudioChunk,
  uploadGreetingAudio,
  getGreetingAudioUrl,
  getCachedCoachAudioUrl,
} from "./lib/storage";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createAccountDeletionRoutes } from "./routes/account-deletion";
import { deleteUserAccount } from "./lib/account-deletion";
import { sendDeletionConfirmationEmail } from "./lib/account-deletion-email";
import { extractMemory } from "./lib/extract-memory";
import { generateFeedback } from "./lib/generate-feedback";

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

  // CORS for the admin app (Vercel-hosted Next.js). Applied to /admin/* BEFORE
  // the route mounts so preflight requests and credentialed cross-origin calls
  // pass before requireAdmin runs. Allowed origins come from a comma-separated
  // env var so we don't hard-code Vercel domains.
  const adminAllowedOrigins = (env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    "/admin/*",
    cors({
      origin: (origin) =>
        origin && adminAllowedOrigins.includes(origin) ? origin : null,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "X-Cron-Secret"],
    }),
  );

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

  // CORS for /account-deletion/* (the anonymous public-web routes hit by the
  // /delete-account page). Mount BEFORE the routes so preflight OPTIONS
  // passes. Allowed origins are derived from PUBLIC_WEB_BASE_URL + localhost
  // so we don't need a separate env var; if you serve the web app from
  // another origin (preview deploys, alt domains), add them here.
  const publicWebOrigin = new URL(env.PUBLIC_WEB_BASE_URL).origin;
  const accountDeletionAllowedOrigins = [
    publicWebOrigin,
    "http://localhost:3002",
  ];
  app.use(
    "/account-deletion/*",
    cors({
      origin: (origin) =>
        origin && accountDeletionAllowedOrigins.includes(origin)
          ? origin
          : null,
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Account deletion: shared deps used by both anonymous (web) and
  // authenticated (in-app) routes. Mount the anonymous routes BEFORE the
  // /v1/* auth middleware so /account-deletion/request + /confirm don't
  // require a JWT.
  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  const resend = new Resend(env.RESEND_API_KEY);
  const accountDeletionDeps = {
    secret: env.ACCOUNT_DELETION_SECRET,
    publicWebBaseUrl: env.PUBLIC_WEB_BASE_URL,
    findUserByEmail: async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (error) throw error;
      const u = data.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (!u) return null;
      const profile = await db.query.profiles.findFirst({
        where: (p, { eq }) => eq(p.userId, u.id),
      });
      return { id: u.id, displayName: profile?.displayName ?? "" };
    },
    sendEmail: (input: {
      to: string;
      displayName: string;
      confirmUrl: string;
    }) =>
      sendDeletionConfirmationEmail({
        resend,
        to: input.to,
        displayName: input.displayName,
        confirmUrl: input.confirmUrl,
      }),
    deleteUser: (userId: string) =>
      deleteUserAccount({ db, supabaseAdmin, userId }),
  };
  app.route(
    "/account-deletion",
    createAccountDeletionRoutes(accountDeletionDeps),
  );

  // Auth-required routes: /v1/* requires a valid Supabase JWT.
  const auth = createAuthMiddleware(verifier);
  app.use("/v1/*", auth);

  app.route(
    "/v1/account-deletion",
    createAccountDeletionRoutes(accountDeletionDeps),
  );

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
      extractMemory: (input) => extractMemory(openai, input),
      generateFeedback: (input) => generateFeedback(openai, input),
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

  app.route("/v1/memory", createMemoryRoutes({ db }));

  app.route("/v1", createFeedbackRoutes({ db }));

  return app;
}
