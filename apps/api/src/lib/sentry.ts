import * as Sentry from "@sentry/node";
import type { Env } from "../env";

export function initSentry(env: Env) {
  if (env.NODE_ENV === "test") return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(err, { extra: context });
}
