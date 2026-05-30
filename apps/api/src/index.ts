import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { initSentry } from "./lib/sentry";
import { startPushRunner } from "./jobs/push-runner";

const env = loadEnv();
initSentry(env);
// Share a single Database instance between the HTTP app and the push runner so
// they share the underlying postgres connection pool.
const db = createDb(env);
const app = createApp(env, db);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});

// Plan 8 M5: start the push notification scheduler. Polls every 60s for
// due rows and fires them via Expo Push.
startPushRunner(db);
