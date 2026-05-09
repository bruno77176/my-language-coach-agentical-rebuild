import pino from "pino";
import type { Env } from "../env";

export function createLogger(env: Env) {
  return pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    base: { env: env.NODE_ENV },
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
