import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import type { Logger } from "../lib/logger";

export function createLoggingMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const requestId = randomUUID();
    const start = Date.now();
    const log = logger.child({
      requestId,
      route: c.req.path,
      method: c.req.method,
    });
    c.set("logger", log);

    await next();

    const durationMs = Date.now() - start;
    log.info({ status: c.res.status, durationMs }, "request completed");
  };
}
