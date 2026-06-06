import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { initSentry } from "./lib/sentry";
import { startPushRunner } from "./jobs/push-runner";
import { createVoiceLiveRoute } from "./routes/voice-live";
import { makeLoadContext } from "./routes/voice-live-context";
import { createSupabaseLocalVerifier } from "./lib/local-jwt-verifier";
import { parseLiveVoiceIds } from "./lib/voice-entitlement";
import type { RawLiveSocket } from "./providers/deepgram-live";
import { createDeepgram } from "./providers/deepgram";
import { createOpenAI, streamChatCompletion } from "./providers/openai";
import { createElevenLabs } from "./providers/elevenlabs";
import { makeSynthesizeSpeech } from "./providers/tts-router";
import { makeGoogleAccessTokenProvider } from "./lib/google-tts-auth";

const env = loadEnv();
initSentry(env);
// Share a single Database instance between the HTTP app and the push runner so
// they share the underlying postgres connection pool.
const db = createDb(env);
const app = createApp(env, db);

// WebSocket support for the Live voice route. createNodeWebSocket attaches to
// the existing app; we register the Live route with upgradeWebSocket, then
// inject the ws handler into the node server below. HTTP routes (app.fetch)
// are unaffected.
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const deepgram = createDeepgram(env);
const openai = createOpenAI(env);
const eleven = createElevenLabs(env);
const geminiAuth = env.GOOGLE_TTS_SA_JSON_B64
  ? makeGoogleAccessTokenProvider(
      Buffer.from(env.GOOGLE_TTS_SA_JSON_B64, "base64").toString("utf8"),
    )
  : undefined;
const synthesizeSpeech = makeSynthesizeSpeech({
  openai,
  eleven,
  geminiAuth,
  inworldKey: env.INWORLD_API_KEY,
});

app.route(
  "/v1",
  createVoiceLiveRoute({
    upgradeWebSocket,
    verifier: createSupabaseLocalVerifier(env),
    liveUserIds: parseLiveVoiceIds(env.VOICE_LIVE_USER_IDS),
    // Deepgram v5 marks Authorization required on the live ConnectArgs; the
    // WS auth scheme is `Token <key>`.
    connectDeepgram: (args) => {
      const connectArgs = {
        ...args,
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      } as Parameters<typeof deepgram.listen.v1.connect>[0];
      // NOTE: the returned socket is inert until openLiveTranscription calls
      // sock.connect() — listen.v1.connect() does NOT auto-start it.
      return deepgram.listen.v1.connect(
        connectArgs,
      ) as unknown as Promise<RawLiveSocket>;
    },
    runTurnDeps: {
      streamChatCompletion: (input) => streamChatCompletion(openai, input),
      synthesizeSpeech,
    },
    loadContext: makeLoadContext(db),
  }),
);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
injectWebSocket(server);

// Plan 8 M5: start the push notification scheduler. Polls every 60s for
// due rows and fires them via Expo Push.
startPushRunner(db);
