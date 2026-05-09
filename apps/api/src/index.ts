import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadEnv } from "./env";
import { initSentry } from "./lib/sentry";

const env = loadEnv();
initSentry(env);
const app = createApp(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
