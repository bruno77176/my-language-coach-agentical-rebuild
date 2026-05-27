import type { MiddlewareHandler } from "hono";
import type { Verifier } from "../middleware/auth";

export type RequireAdminConfig = {
  adminUserIds: string[];
  verify: Verifier;
};

export function createRequireAdmin(
  cfg: RequireAdminConfig,
): MiddlewareHandler<{ Variables: { userId: string } }> {
  const allow = new Set(cfg.adminUserIds);
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Missing token" } },
        401,
      );
    }
    let userId: string;
    try {
      const r = await cfg.verify(auth.slice("Bearer ".length));
      userId = r.userId;
    } catch {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token" } },
        401,
      );
    }
    if (!allow.has(userId)) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Not an admin" } },
        403,
      );
    }
    c.set("userId", userId);
    await next();
  };
}

export function parseAdminIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
