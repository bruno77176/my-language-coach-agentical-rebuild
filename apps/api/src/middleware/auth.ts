import type { MiddlewareHandler } from "hono";

export type VerifyResult = { userId: string };
export type Verifier = (token: string) => Promise<VerifyResult>;

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
