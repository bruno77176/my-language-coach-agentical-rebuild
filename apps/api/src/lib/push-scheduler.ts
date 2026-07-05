import { and, eq, isNull, lte, gt, or, sql } from "drizzle-orm";
import { pushSchedule } from "../db/schema";
import type { Database } from "../db";
import type { PushKind } from "@language-coach/shared";

export type { PushKind };

export type SchedulePushInput = {
  userId: string;
  kind: PushKind;
  sendAt: Date;
  payload?: Record<string, unknown>;
};

export async function schedulePush(
  db: Database,
  input: SchedulePushInput,
): Promise<void> {
  await db.insert(pushSchedule).values({
    userId: input.userId,
    kind: input.kind,
    sendAt: input.sendAt,
    payload: input.payload ?? {},
  });
}

export function computeDay1At(now: Date, tz: string): Date {
  // Best-effort: ~9am local time the day after `now`. Stored UTC.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const y = +parts.find((p) => p.type === "year")!.value;
  const m = +parts.find((p) => p.type === "month")!.value;
  const d = +parts.find((p) => p.type === "day")!.value;
  // Construct 09:00 local; treat as UTC (slight skew across DST OK for v1)
  return new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T09:00:00`,
  );
}

export async function scheduleOnboardingPushes(
  db: Database,
  userId: string,
  timezone: string,
): Promise<void> {
  // Idempotency: skip if any day-1-feedback row already exists for this user.
  const existing = await db.query.pushSchedule.findFirst({
    where: (t, { eq: e, and: a }) =>
      a(e(t.userId, userId), e(t.kind, "day-1-feedback")),
  });
  if (existing) return;

  const now = new Date();
  const day1 = computeDay1At(now, timezone);
  const day2 = new Date(day1.getTime() + 86400000 + 10 * 3600 * 1000); // ~7pm next day
  const day7 = new Date(day1.getTime() + 6 * 86400000 + 9 * 3600 * 1000); // ~6pm day 7

  await Promise.all([
    schedulePush(db, { userId, kind: "day-1-feedback", sendAt: day1 }),
    schedulePush(db, { userId, kind: "day-2-warmup", sendAt: day2 }),
    schedulePush(db, { userId, kind: "day-7-summary", sendAt: day7 }),
  ]);
}

export type DuePush = {
  id: string;
  userId: string;
  kind: PushKind;
  payload: Record<string, unknown>;
};

export async function pickDuePushes(
  db: Database,
  now: Date,
  limit = 50,
): Promise<DuePush[]> {
  const rows = await db
    .select({
      id: pushSchedule.id,
      userId: pushSchedule.userId,
      kind: pushSchedule.kind,
      payload: pushSchedule.payload,
    })
    .from(pushSchedule)
    .where(
      and(
        isNull(pushSchedule.sentAt),
        isNull(pushSchedule.cancelledAt),
        lte(pushSchedule.sendAt, now),
      ),
    )
    .limit(limit);
  return rows as DuePush[];
}

export async function markSent(db: Database, id: string): Promise<void> {
  await db
    .update(pushSchedule)
    .set({ sentAt: new Date() })
    .where(eq(pushSchedule.id, id));
}

/**
 * Schedule a friendly "come back" reminder for users who have lapsed — no
 * message activity for `lapseDays`. Idempotent: skips a user who already has an
 * unsent reminder pending, or one sent within `minResendDays`, so a lapsed user
 * is nudged at most ~weekly, never spammed. Only users with a registered push
 * token are considered (nothing to send otherwise). Sends at ~9am the user's
 * next local day. Returns how many reminders were scheduled.
 */
export async function scheduleInactivityReminders(
  db: Database,
  now: Date,
  opts: { lapseDays?: number; minResendDays?: number; limit?: number } = {},
): Promise<number> {
  const lapseDays = opts.lapseDays ?? 3;
  const minResendDays = opts.minResendDays ?? 6;
  const limit = opts.limit ?? 500;
  const lapseCutoff = new Date(now.getTime() - lapseDays * 86_400_000);
  const resendCutoff = new Date(now.getTime() - minResendDays * 86_400_000);

  // Last activity = newest message across the user's conversations (works for
  // threads, whose conversations.started_at is just the thread-creation time).
  const res = await db.execute(sql`
    SELECT c.user_id AS user_id, p.timezone AS timezone
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN profiles p ON p.user_id = c.user_id
    WHERE EXISTS (SELECT 1 FROM push_tokens pt WHERE pt.user_id = c.user_id)
    GROUP BY c.user_id, p.timezone
    HAVING MAX(m.created_at) < ${lapseCutoff.toISOString()}
    LIMIT ${limit}
  `);
  const rows = (
    Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ user_id: string; timezone: string | null }>;

  let scheduled = 0;
  for (const r of rows) {
    const userId = r.user_id;
    const tz = r.timezone ?? "UTC";
    // Idempotency: skip if a reminder is pending (unsent) or was sent recently.
    const recent = await db.query.pushSchedule.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(
          e(t.userId, userId),
          e(t.kind, "inactivity-reminder"),
          or(isNull(t.sentAt), gt(t.sentAt, resendCutoff)),
        ),
    });
    if (recent) continue;
    // onConflictDoNothing backstops the read-then-write race across concurrent
    // sweeps (e.g. two machines during a deploy) via the partial unique index
    // push_schedule_pending_inactivity_uniq (migration 0024). Count only rows
    // that actually inserted.
    const insertedRow = await db
      .insert(pushSchedule)
      .values({
        userId,
        kind: "inactivity-reminder",
        sendAt: computeDay1At(now, tz),
        payload: {},
      })
      .onConflictDoNothing()
      .returning({ id: pushSchedule.id });
    if (insertedRow.length > 0) scheduled++;
  }
  return scheduled;
}
