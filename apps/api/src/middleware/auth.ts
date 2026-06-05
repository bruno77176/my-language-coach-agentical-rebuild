import type { MiddlewareHandler } from "hono";

export type VerifyResult = { userId: string };
export type Verifier = (token: string) => Promise<VerifyResult>;

// Wraps a middleware so it is skipped for WebSocket upgrade requests. WS
// handshakes can't carry an Authorization header (so the header-based auth
// would 401 them before the upgrade); the WS route authenticates via its own
// query token instead. Without this, /v1/voice/live is rejected with 401.
export function skipForWebSocket(mw: MiddlewareHandler): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
      return next();
    }
    return mw(c, next);
  };
}

export function createAuthMiddleware(verify: Verifier): MiddlewareHandler<{
  Variables: { userId: string };
}> {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing Authorization header",
          },
        },
        401,
      );
    }
    const token = authHeader.slice("Bearer ".length);

    try {
      const { userId } = await verify(token);
      c.set("userId", userId);
      await next();
    } catch (err) {
      // Log the real reason (expired JWT, email-not-confirmed, Supabase
      // network failure, …) — the client only ever sees a generic message, so
      // without this the cause of a 401 is invisible in the field. Never log
      // the token itself.
      console.warn(`[auth] token rejected: ${(err as Error).message}`);
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token" } },
        401,
      );
    }
  };
}
