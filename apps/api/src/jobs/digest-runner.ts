import { eq, and, sql, lt } from "drizzle-orm";
import type OpenAI from "openai";
import type { Database } from "../db";
import { digestJobs } from "../db/schema";
import type { DigestJobRow } from "../db/schema";
import { loadTranscript, makeDigestDeps } from "../lib/digest-repo";
import { runDigest } from "../lib/run-digest";
import { runPlanGeneration } from "../lib/run-plan-generation";
import { reportError } from "../lib/sentry";
import { makeOnUsage } from "../lib/usage-bridge";

const MAX_ATTEMPTS = 3;

/**
 * Optimistic claim: find the oldest pending job and flip it to "running"
 * atomically. Returns null if no pending job exists or another worker
 * claimed it first (race condition → RETURNING is empty).
 */
export async function claimNextJob(db: Database): Promise<DigestJobRow | null> {
  const pending = await db.query.digestJobs.findFirst({
    where: (t, { eq: e }) => e(t.status, "pending"),
    orderBy: (t, { asc: a }) => [a(t.createdAt)],
  });
  if (!pending) return null;

  const [claimed] = await db
    .update(digestJobs)
    .set({
      status: "running",
      attempts: sql`${digestJobs.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(digestJobs.id, pending.id), eq(digestJobs.status, "pending")))
    .returning();

  return claimed ?? null;
}

/**
 * Requeue stale running jobs — jobs that are stuck in "running" status for
 * longer than `staleMs` milliseconds (default 10 minutes). This guards against
 * process crashes or restarts that leave jobs permanently in-flight.
 *
 * Returns the number of jobs requeued.
 */
export async function requeueStaleJobs(
  db: Database,
  staleMs = 600_000,
): Promise<number> {
  const rows = await db
    .update(digestJobs)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(digestJobs.status, "running"),
        lt(digestJobs.updatedAt, new Date(Date.now() - staleMs)),
      ),
    )
    .returning();
  return rows.length;
}

/**
 * Injectable run function type — default is the real digest pipeline.
 * Tests pass a stub to avoid real DB/OpenAI work.
 */
type RunFn = (
  db: Database,
  openai: OpenAI,
  job: DigestJobRow,
) => Promise<unknown>;

async function defaultRun(
  db: Database,
  openai: OpenAI,
  job: DigestJobRow,
): Promise<unknown> {
  const onUsage = makeOnUsage(db, {
    userId: job.userId,
    platform: "server",
    conversationId: job.conversationId,
  });

  // Continuous-thread checkpoints scope the digest to the segment; scenario/
  // legacy jobs (no checkpoint_id) digest the whole conversation.
  let range: { start: Date; end: Date } | undefined;
  if (job.checkpointId) {
    const cp = await db.query.sessionCheckpoints.findFirst({
      where: (t, { eq: e }) => e(t.id, job.checkpointId!),
    });
    if (cp) range = { start: cp.startedAt, end: cp.endedAt };
  }
  const transcript = await loadTranscript(db, job.conversationId, range);
  const result = await runDigest(
    { transcript, languageCode: job.languageCode },
    makeDigestDeps(db, openai, job, onUsage),
  );

  // Best-effort: generate and persist a next-lesson plan from the user's top
  // memory items. A failure here must NEVER fail the digest job — we wrap it
  // in its own try/catch and only report the error to Sentry.
  // This runs in defaultRun (not in processOneJob) so tests that inject a
  // stub `run` function bypass this step and stay green.
  try {
    await runPlanGeneration(
      db,
      openai,
      { userId: job.userId, languageCode: job.languageCode },
      onUsage,
    );
  } catch (err) {
    reportError(err, { where: "digest.plan-generation", jobId: job.id });
  }

  return result;
}

/**
 * Claim one job and process it. Returns:
 * - "idle"      — no pending jobs, OR an error occurred (deliberately stops the
 *                 drain loop so the still-pending job is retried on the NEXT
 *                 30 s tick rather than being burst-retried in the same tick)
 * - "skipped"   — user not Pro or memory disabled (job marked "done"; safe to
 *                 continue draining because no retry is needed)
 * - "processed" — pipeline ran successfully
 *
 * The optional `run` parameter is injectable for unit tests.
 */
export async function processOneJob(
  db: Database,
  openai: OpenAI,
  run: RunFn = defaultRun,
): Promise<"processed" | "skipped" | "idle"> {
  const job = await claimNextJob(db);
  if (!job) return "idle";

  try {
    const [entitlement, profile] = await Promise.all([
      db.query.entitlements.findFirst({
        where: (t, { eq: e }) => e(t.userId, job.userId),
      }),
      db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, job.userId),
      }),
    ]);

    // Pro gate: plan must be "pro" and proUntil must be a future timestamp.
    // Mirrors voice.ts:501-506.
    const isPro =
      entitlement?.plan === "pro" &&
      entitlement.proUntil != null &&
      entitlement.proUntil > new Date();

    if (!isPro || !profile?.memoryEnabled) {
      await db
        .update(digestJobs)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(digestJobs.id, job.id));
      return "skipped";
    }

    await run(db, openai, job);

    await db
      .update(digestJobs)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(digestJobs.id, job.id));

    return "processed";
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // job.attempts is post-claim (already incremented by claimNextJob).
    const newStatus = job.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await db
      .update(digestJobs)
      .set({ status: newStatus, lastError: errMsg, updatedAt: new Date() })
      .where(eq(digestJobs.id, job.id));
    reportError(err, { where: "digest-runner.processOneJob", jobId: job.id });
    // Return "idle" (not "skipped") so the drain loop in startDigestWorker
    // exits after an error. The job is still "pending" (unless exhausted →
    // "failed"), so it will be retried on the next 30 s tick instead of being
    // burst-retried in the same tick.
    return "idle";
  }
}

/**
 * Start the in-process digest worker. Mirrors startPushRunner in push-runner.ts:
 * drains all pending jobs on each tick, then waits for the next interval.
 */
export function startDigestWorker(
  db: Database,
  openai: OpenAI,
  intervalMs = 30_000,
) {
  const tick = async () => {
    try {
      await requeueStaleJobs(db);
      while ((await processOneJob(db, openai)) !== "idle") {
        // drain until no pending jobs remain
      }
    } catch (err) {
      reportError(err, { where: "digest-runner.tick" });
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}
