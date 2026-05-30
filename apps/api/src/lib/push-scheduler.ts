import { and, eq, isNull, lte } from "drizzle-orm";
import { pushSchedule } from "../db/schema";
import type { Database } from "../db";

export type PushKind = "day-1-feedback" | "day-2-warmup" | "day-7-summary";

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

export function bodyFor(kind: PushKind): {
  title: string;
  body: string;
  data?: { url: string };
} {
  switch (kind) {
    case "day-1-feedback":
      return {
        title: "Your first feedback report is ready",
        body: "Your coach has notes from yesterday's session. Take a look.",
        data: { url: "mylanguagecoach://practice" },
      };
    case "day-2-warmup":
      return {
        title: "5 minutes with your coach?",
        body: "A quick warmup keeps the streak alive.",
        data: { url: "mylanguagecoach://practice" },
      };
    case "day-7-summary":
      return {
        title: "Your first week with your coach",
        body: "See your progress so far.",
        data: { url: "mylanguagecoach://weekly-summary" },
      };
  }
}
