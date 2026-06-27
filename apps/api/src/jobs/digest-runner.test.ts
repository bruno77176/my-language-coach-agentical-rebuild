/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { processOneJob, requeueStaleJobs } from "./digest-runner";

const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

function makeDb(options: {
  pendingJob?: any;
  claimedJob?: any;
  entitlement?: any;
  profile?: any;
}) {
  const {
    pendingJob = null,
    claimedJob = null,
    entitlement = null,
    profile = null,
  } = options;

  const sets: any[] = [];

  const returning = vi.fn().mockResolvedValue(claimedJob ? [claimedJob] : []);

  const where = vi.fn().mockImplementation(() => {
    // Must be both directly awaitable (for status updates) AND have .returning()
    const p = Promise.resolve(undefined) as any;
    p.returning = returning;
    return p;
  });

  const set = vi.fn().mockImplementation((args: any) => {
    sets.push(args);
    return { where };
  });

  return {
    _sets: sets,
    _returning: returning,
    query: {
      digestJobs: {
        findFirst: vi.fn().mockResolvedValue(pendingJob),
      },
      entitlements: {
        findFirst: vi.fn().mockResolvedValue(entitlement),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue(profile),
      },
    },
    update: vi.fn().mockReturnValue({ set }),
  } as any;
}

const pendingJob = {
  id: "job-1",
  userId: "user-1",
  conversationId: "conv-1",
  languageCode: "de",
  status: "pending",
  attempts: 0,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const claimedJob = { ...pendingJob, status: "running", attempts: 1 };

const proEntitlement = { plan: "pro", proUntil: FUTURE_DATE };
const freeEntitlement = { plan: "free", proUntil: null };
const enabledProfile = { memoryEnabled: true };

describe("requeueStaleJobs", () => {
  it("issues the update and returns the count of requeued rows", async () => {
    const fakeRows = [{ id: "job-1" }, { id: "job-2" }];
    const returning = vi.fn().mockResolvedValue(fakeRows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const db = { update: vi.fn().mockReturnValue({ set }) } as any;

    const count = await requeueStaleJobs(db, 600_000);

    expect(db.update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(where).toHaveBeenCalledOnce();
    expect(returning).toHaveBeenCalledOnce();
    expect(count).toBe(2);
  });
});

describe("processOneJob", () => {
  it("returns idle when no pending job", async () => {
    const db = makeDb({ pendingJob: null });
    const result = await processOneJob(db, {} as any);
    expect(result).toBe("idle");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("skips and marks done for a free user — run NOT called", async () => {
    const run = vi.fn();
    const db = makeDb({
      pendingJob,
      claimedJob,
      entitlement: freeEntitlement,
      profile: enabledProfile,
    });
    const result = await processOneJob(db, {} as any, run);
    expect(result).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
    // The final set call should mark status "done"
    const lastSet = db._sets[db._sets.length - 1];
    expect(lastSet).toMatchObject({ status: "done" });
  });

  it("skips and marks done when memoryEnabled is false", async () => {
    const run = vi.fn();
    const db = makeDb({
      pendingJob,
      claimedJob,
      entitlement: proEntitlement,
      profile: { memoryEnabled: false },
    });
    const result = await processOneJob(db, {} as any, run);
    expect(result).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
    const lastSet = db._sets[db._sets.length - 1];
    expect(lastSet).toMatchObject({ status: "done" });
  });

  it("calls run and marks done for a Pro user with memory enabled", async () => {
    const run = vi.fn().mockResolvedValue({ inserted: 1, bumped: 0 });
    const db = makeDb({
      pendingJob,
      claimedJob,
      entitlement: proEntitlement,
      profile: enabledProfile,
    });
    const result = await processOneJob(db, {} as any, run);
    expect(result).toBe("processed");
    expect(run).toHaveBeenCalledOnce();
    const lastSet = db._sets[db._sets.length - 1];
    expect(lastSet).toMatchObject({ status: "done" });
  });

  it("sets status pending on error when attempts < MAX_ATTEMPTS", async () => {
    const run = vi.fn().mockRejectedValue(new Error("boom"));
    const db = makeDb({
      pendingJob,
      claimedJob: { ...claimedJob, attempts: 1 }, // post-claim = 1, below threshold 3
      entitlement: proEntitlement,
      profile: enabledProfile,
    });
    const result = await processOneJob(db, {} as any, run);
    // Returns "idle" on error so the drain loop exits and retry happens next tick
    expect(result).toBe("idle");
    const lastSet = db._sets[db._sets.length - 1];
    expect(lastSet).toMatchObject({ status: "pending", lastError: "boom" });
  });

  it("sets status failed on error when attempts >= MAX_ATTEMPTS", async () => {
    const run = vi.fn().mockRejectedValue(new Error("too many"));
    const db = makeDb({
      pendingJob,
      claimedJob: { ...claimedJob, attempts: 3 }, // post-claim = 3, at threshold
      entitlement: proEntitlement,
      profile: enabledProfile,
    });
    const result = await processOneJob(db, {} as any, run);
    // Returns "idle" on error so the drain loop exits (job is now "failed")
    expect(result).toBe("idle");
    const lastSet = db._sets[db._sets.length - 1];
    expect(lastSet).toMatchObject({ status: "failed", lastError: "too many" });
  });
});
