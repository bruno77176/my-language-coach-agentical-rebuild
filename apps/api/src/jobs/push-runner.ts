import {
  pickDuePushes,
  markSent,
  scheduleInactivityReminders,
  type DuePush,
} from "../lib/push-scheduler";
import { pushTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildPushCopy } from "@language-coach/shared";
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

// Periodically schedule "come back" reminders for lapsed users. Idempotent and
// safe to run often (every 6h by default) — it survives machine restarts and
// won't double-schedule. The push-runner above then delivers the rows at ~9am
// local, in the user's native language.
export function startInactivitySweep(
  db: Database,
  intervalMs = 6 * 60 * 60 * 1000,
) {
  const tick = async () => {
    try {
      await scheduleInactivityReminders(db, new Date());
    } catch (err) {
      reportError(err, { where: "inactivity-sweep.tick" });
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}

async function trySend(db: Database, p: DuePush) {
  const [tokens, profile] = await Promise.all([
    db
      .select({ token: pushTokens.expoPushToken })
      .from(pushTokens)
      .where(eq(pushTokens.userId, p.userId)),
    db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, p.userId),
    }),
  ]);
  if (tokens.length === 0) {
    await markSent(db, p.id);
    return;
  }
  // Localize to the user's native language (falls back to English).
  const { title, body, data } = buildPushCopy(
    p.kind,
    profile?.nativeLang ?? "en",
  );
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
