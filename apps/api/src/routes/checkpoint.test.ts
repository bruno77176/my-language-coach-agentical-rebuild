import { describe, expect, it, vi } from "vitest";
import {
  upsertStreakDay,
  runFeedbackAndMemory,
  maybeCheckpoint,
} from "./checkpoint";

const userId = "00000000-0000-0000-0000-000000000001";
const conversationId = "11111111-1111-1111-1111-111111111111";
const checkpointId = "22222222-2222-2222-2222-222222222222";

// Let all chained fire-and-forget microtasks settle.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("upsertStreakDay", () => {
  it("executes the streak upsert and reports goalReached=true when met", async () => {
    const db = { execute: vi.fn().mockResolvedValue([]) };
    const { goalReached } = await upsertStreakDay(db as never, {
      userId,
      timezone: "Europe/Paris",
      secondsSpoken: 700,
      dailyGoalMinutes: 10, // 600s goal
      now: new Date("2026-07-05T12:00:00Z"),
    });
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(goalReached).toBe(true);
  });

  it("reports goalReached=false when under the goal", async () => {
    const db = { execute: vi.fn().mockResolvedValue([]) };
    const { goalReached } = await upsertStreakDay(db as never, {
      userId,
      timezone: "UTC",
      secondsSpoken: 120,
      dailyGoalMinutes: 10,
      now: new Date("2026-07-05T12:00:00Z"),
    });
    expect(goalReached).toBe(false);
  });
});

type Captured = { table: unknown; values?: unknown };

function makeFakeDb(transcript: Array<{ role: string; text: string }>) {
  const inserts: Captured[] = [];
  const updates: Array<{ set: unknown }> = [];
  const db = {
    query: {
      coachMemory: { findFirst: vi.fn().mockResolvedValue(undefined) },
      messages: { findMany: vi.fn().mockResolvedValue(transcript) },
    },
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        inserts.push({ table, values });
        return {
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((set: unknown) => {
        updates.push({ set });
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
  };
  return { db, inserts, updates };
}

describe("maybeCheckpoint segment seconds (QA-2)", () => {
  it("counts first→last activity, NOT the idle gap since the last checkpoint", async () => {
    const insertedValues: Array<Record<string, unknown>> = [];
    const db = {
      query: {
        sessionCheckpoints: {
          // Last checkpoint ended 2 days before this segment's first message.
          findFirst: vi
            .fn()
            .mockResolvedValue({ endedAt: new Date("2026-07-01T10:00:00Z") }),
        },
        messages: {
          findFirst: vi
            .fn()
            // 1st call = newest (desc): segment's last activity.
            .mockResolvedValueOnce({ createdAt: "2026-07-03T10:05:00Z" })
            // 2nd call = first un-checkpointed (asc): segment's first activity.
            .mockResolvedValueOnce({ createdAt: "2026-07-03T10:00:00Z" }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        coachMemory: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      insert: vi.fn(() => ({
        values: vi.fn((v: Record<string, unknown>) => {
          insertedValues.push(v);
          const p = Promise.resolve(undefined) as unknown as {
            onConflictDoNothing: (t?: unknown) => unknown;
          } & Promise<undefined>;
          p.onConflictDoNothing = () => {
            const q = Promise.resolve(undefined) as unknown as {
              returning: () => Promise<Array<{ id: string }>>;
            } & Promise<undefined>;
            q.returning = () => Promise.resolve([{ id: checkpointId }]);
            return q;
          };
          return p;
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    };

    const result = await maybeCheckpoint({
      db: db as never,
      deps: {
        generateFeedback: vi.fn().mockResolvedValue(null),
        extractMemory: vi.fn().mockResolvedValue(null),
      } as never,
      conversation: {
        id: conversationId,
        userId,
        language: "es",
        startedAt: new Date("2026-06-01T00:00:00Z"),
      },
      profile: {
        timezone: "UTC",
        dailyGoalMinutes: 10,
        memoryEnabled: false,
        nativeLang: "en",
      },
      platform: "ios",
      now: new Date("2026-07-03T10:10:00Z"),
      force: true,
      inactivityMs: 0,
    });
    await flush();

    // Segment = 10:00 → 10:05 = 300s. The OLD code counted from the last
    // checkpoint's endedAt (07-01), giving ~2 days.
    expect(result?.secondsSpoken).toBe(300);
    const cp = insertedValues.find((v) => "secondsSpoken" in v);
    expect(cp?.secondsSpoken).toBe(300);
    expect(cp?.startedAt).toEqual(new Date("2026-07-03T10:00:00Z"));
  });
});

describe("runFeedbackAndMemory", () => {
  it("keys feedback + digest on the checkpoint and generates feedback for a thread segment", async () => {
    const { db, inserts, updates } = makeFakeDb([
      { role: "user", text: "hola" },
      { role: "coach", text: "hola, ¿qué tal?" },
    ]);
    const extractMemory = vi.fn().mockResolvedValue(null);
    const generateFeedback = vi.fn().mockResolvedValue({
      highlights: ["nice"],
      corrections: [],
      vocab: [],
    });

    await runFeedbackAndMemory({
      db: db as never,
      deps: { extractMemory, generateFeedback },
      userId,
      conversationId,
      language: "es",
      nativeLang: "en",
      memoryEnabled: true,
      platform: "mobile",
      since: new Date("2026-07-05T11:00:00Z"),
      checkpointId,
    });
    await flush();

    // Pending feedback row carries the checkpoint id.
    const feedbackInsert = inserts.find(
      (i) =>
        (i.values as { checkpointId?: string }).checkpointId === checkpointId,
    );
    expect(feedbackInsert).toBeTruthy();
    // Feedback was generated over the segment transcript, then marked ready.
    expect(generateFeedback).toHaveBeenCalledTimes(1);
    expect(
      updates.some((u) => (u.set as { status?: string }).status === "ready"),
    ).toBe(true);
    // Memory extraction ran (consent on).
    expect(extractMemory).toHaveBeenCalledTimes(1);
    // A digest job was enqueued with the checkpoint id.
    expect(
      inserts.some(
        (i) =>
          (i.values as { checkpointId?: string; languageCode?: string })
            .languageCode === "es" &&
          (i.values as { checkpointId?: string }).checkpointId === checkpointId,
      ),
    ).toBe(true);
  });

  it("skips memory extraction + digest when memory consent is off (feedback still runs)", async () => {
    const { db } = makeFakeDb([{ role: "user", text: "hi" }]);
    const extractMemory = vi.fn().mockResolvedValue(null);
    const generateFeedback = vi.fn().mockResolvedValue(null);

    await runFeedbackAndMemory({
      db: db as never,
      deps: { extractMemory, generateFeedback },
      userId,
      conversationId,
      language: "es",
      nativeLang: "en",
      memoryEnabled: false,
      platform: "unknown",
      since: null,
      checkpointId: null,
    });
    await flush();

    expect(extractMemory).not.toHaveBeenCalled();
    expect(generateFeedback).toHaveBeenCalledTimes(1);
  });
});
