import { Hono } from "hono";
import { z } from "zod";
import {
  signDeletionToken,
  verifyDeletionToken,
} from "../lib/account-deletion-token";

export type FindUserByEmailFn = (
  email: string,
) => Promise<{ id: string; displayName: string } | null>;

export type SendDeletionEmailFn = (input: {
  to: string;
  displayName: string;
  confirmUrl: string;
}) => Promise<void>;

export type DeleteUserFn = (userId: string) => Promise<void>;

export type AccountDeletionDeps = {
  secret: string;
  publicWebBaseUrl: string;
  findUserByEmail: FindUserByEmailFn;
  sendEmail: SendDeletionEmailFn;
  deleteUser: DeleteUserFn;
};

const RequestSchema = z.object({ email: z.string().email() });
const ConfirmSchema = z.object({ token: z.string().min(1) });

export function createAccountDeletionRoutes(deps: AccountDeletionDeps) {
  const app = new Hono<{ Variables: { userId?: string } }>();

  app.post("/request", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_INPUT" } }, 400);
    }
    const user = await deps.findUserByEmail(parsed.data.email);
    if (user) {
      const token = await signDeletionToken(deps.secret, user.id);
      const confirmUrl = `${deps.publicWebBaseUrl}/delete-account/confirm?token=${encodeURIComponent(token)}`;
      try {
        await deps.sendEmail({
          to: parsed.data.email,
          displayName: user.displayName,
          confirmUrl,
        });
      } catch (err) {
        // Surface in logs but still return 200 to avoid enumeration.
        console.error("[account-deletion] sendEmail failed", err);
      }
    }
    return c.json({ ok: true });
  });

  app.post("/confirm", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_INPUT" } }, 400);
    }
    let payload: { userId: string };
    try {
      payload = await verifyDeletionToken(deps.secret, parsed.data.token);
    } catch {
      return c.json({ error: { code: "INVALID_TOKEN" } }, 400);
    }
    try {
      await deps.deleteUser(payload.userId);
    } catch (err) {
      console.error("[account-deletion] deleteUser failed", err);
      return c.json({ error: { code: "DELETION_FAILED" } }, 500);
    }
    return c.json({ ok: true });
  });

  app.post("/self", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: { code: "UNAUTHORIZED" } }, 401);
    try {
      await deps.deleteUser(userId);
    } catch (err) {
      console.error("[account-deletion] deleteUser failed", err);
      return c.json({ error: { code: "DELETION_FAILED" } }, 500);
    }
    return c.json({ ok: true });
  });

  return app;
}
