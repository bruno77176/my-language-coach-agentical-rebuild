import { describe, expect, it, vi } from "vitest";
import { upsertStreakDay, runFeedbackAndMemory } from "./checkpoint";

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
