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
    } catch {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token" } },
        401,
      );
    }
  };
}
