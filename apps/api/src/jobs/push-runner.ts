import {
  pickDuePushes,
  markSent,
  bodyFor,
  type DuePush,
} from "../lib/push-scheduler";
import { pushTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { reportError } from "../lib/sentry";

export function startPushRunner(db: Database, intervalMs = 60_000) {
  const tick = async () => {
    try {
      const due = await pickDuePushes(db, new Date());
      for (const p of due) {
        await trySend(db, p);
      }
    } catch (err) {
      reportError(err, { where: "push-runner.tick" });
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}

async function trySend(db: Database, p: DuePush) {
  const tokens = await db
    .select({ token: pushTokens.expoPushToken })
    .from(pushTokens)
    .where(eq(pushTokens.userId, p.userId));
  if (tokens.length === 0) {
    await markSent(db, p.id);
    return;
  }
  const { title, body, data } = bodyFor(p.kind);
  await Promise.all(
    tokens.map((t) =>
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: t.token, title, body, data }),
      }).catch((err) => {
        reportError(err, { where: "push-runner.send" });
      }),
    ),
  );
  await markSent(db, p.id);
}
