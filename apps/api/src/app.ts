import { Hono } from "hono";
import type { Env } from "./env";
import type { Database } from "./db";
import { createDb } from "./db";
import { createLogger, type Logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { createLoggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/error";
import { createHealthRoutes } from "./routes/health";

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

  return app;
}
