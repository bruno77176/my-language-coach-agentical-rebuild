import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { resolveThread, loadThreadMessages } from "./thread";
import { createVoiceRoutes, type VoiceDeps } from "./voice";

const userId = "00000000-0000-0000-0000-000000000001";

const noopProviderDeps: Omit<VoiceDeps, "db"> = {
  transcribeAudio: vi.fn(),
  streamChatCompletion: vi.fn() as unknown as VoiceDeps["streamChatCompletion"],
  synthesizeSpeech: vi.fn(),
  uploadCoachAudioChunk: vi.fn(),
  extractMemory: async () => null,
  generateFeedback: async () => null,
};

function appWithVoice(routes: ReturnType<typeof createVoiceRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/voice", routes);
  return app;
}

describe("resolveThread", () => {
  it("reuses an existing thread without inserting", async () => {
    const startedAt = new Date("2026-07-01T00:00:00Z");
    const db = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({ id: "c1", startedAt }),
        },
      },
      insert: vi.fn(),
    };
    const r = await resolveThread(db as never, userId, "de");
    expect(r).toEqual({ conversationId: "c1", startedAt, isNew: false });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates the thread on first use", async () => {
    const startedAt = new Date("2026-07-05T00:00:00Z");
    const db = {
      query: {
        conversations: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "c2", startedAt }]),
        })),
      })),
    };
    const r = await resolveThread(db as never, userId, "de");
    expect(r).toEqual({ conversationId: "c2", startedAt, isNew: true });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});

describe("loadThreadMessages", () => {
  const row = (id: string, min: number) => ({
    id,
    role: "coach" as const,
    text: id,
    translation: null,
    isGreeting: false,
    createdAt: new Date(`2026-07-05T00:0${min}:00Z`),
  });

  it("returns oldest→newest and flags hasMore when a fuller page exists", async () => {
    // DB yields newest-first (orderBy desc); 3 rows for a limit of 2.
    const db = {
      query: {
        messages: {
          findMany: vi
            .fn()
            .mockResolvedValue([row("m3", 3), row("m2", 2), row("m1", 1)]),
        },
      },
    };
    const { messages, hasMore } = await loadThreadMessages(db as never, "c1", {
      limit: 2,
    });
    expect(hasMore).toBe(true);
    // Keeps the 2 newest, drops the extra oldest, returns ascending.
    expect(messages.map((m) => m.id)).toEqual(["m2", "m3"]);
  });

  it("flags hasMore=false when the page is not full", async () => {
    const db = {
      query: {
        messages: {
          findMany: vi.fn().mockResolvedValue([row("m2", 2), row("m1", 1)]),
        },
      },
    };
    const { messages, hasMore } = await loadThreadMessages(db as never, "c1", {
      limit: 5,
    });
    expect(hasMore).toBe(false);
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("POST /v1/voice/sessions/:id/checkpoint", () => {
  it("no-ops (checkpoint_id null) when nothing new since the last checkpoint", async () => {
    const convId = "11111111-1111-1111-1111-111111111111";
    const db = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: convId,
            userId,
            kind: "thread",
            language: "de",
            startedAt: new Date(),
          }),
        },
        profiles: {
          findFirst: vi.fn().mockResolvedValue({
            timezone: "UTC",
            dailyGoalMinutes: 10,
            memoryEnabled: true,
            nativeLang: "en",
          }),
        },
        sessionCheckpoints: { findFirst: vi.fn().mockResolvedValue(undefined) },
        messages: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      `/v1/voice/sessions/${convId}/checkpoint`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      checkpoint_id: null,
      seconds_spoken: 0,
      goal_reached: false,
    });
  });

  it("creates a checkpoint over the new segment and reports seconds", async () => {
    const convId = "11111111-1111-1111-1111-111111111111";
    const startedAt = new Date("2026-07-05T10:00:00Z");
    const newestAt = new Date("2026-07-05T10:05:00Z"); // +300s
    const db = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: convId,
            userId,
            kind: "thread",
            language: "de",
            startedAt,
          }),
        },
        profiles: {
          findFirst: vi.fn().mockResolvedValue({
            timezone: "UTC",
            dailyGoalMinutes: 10,
            memoryEnabled: false,
            nativeLang: "en",
          }),
        },
        sessionCheckpoints: { findFirst: vi.fn().mockResolvedValue(undefined) },
        // 1st findFirst = newest (segment upper bound); 2nd = first new message
        // (segment lower bound — QA-2). Here 10:00 → 10:05 = 300s.
        messages: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ createdAt: newestAt })
            .mockResolvedValueOnce({ createdAt: startedAt }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        coachMemory: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      // The checkpoint insert uses onConflictDoNothing(...).returning(); other
      // inserts (feedback/digest) await onConflictDoNothing() directly.
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "cp1" }]),
          })),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      `/v1/voice/sessions/${convId}/checkpoint`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checkpoint_id: string;
      seconds_spoken: number;
    };
    expect(body.checkpoint_id).toBe("cp1");
    expect(body.seconds_spoken).toBe(300);
    // Streak upsert ran.
    expect(db.execute).toHaveBeenCalled();
  });

  it("POST /end on a THREAD converts to a checkpoint, not a thread-end (QA-1)", async () => {
    const convId = "11111111-1111-1111-1111-111111111111";
    const startedAt = new Date("2026-07-05T10:00:00Z");
    const newestAt = new Date("2026-07-05T10:05:00Z"); // +300s
    const conversationsUpdate = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    }));
    const db = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: convId,
            userId,
            kind: "thread",
            language: "de",
            startedAt,
            endedAt: null,
            secondsSpoken: 0,
          }),
        },
        profiles: {
          findFirst: vi.fn().mockResolvedValue({
            timezone: "UTC",
            dailyGoalMinutes: 10,
            memoryEnabled: false,
            nativeLang: "en",
          }),
        },
        sessionCheckpoints: { findFirst: vi.fn().mockResolvedValue(undefined) },
        messages: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ createdAt: newestAt })
            .mockResolvedValueOnce({ createdAt: startedAt }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        coachMemory: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "cp1" }]),
          })),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      update: conversationsUpdate,
      execute: vi.fn().mockResolvedValue([]),
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      `/v1/voice/sessions/${convId}/end`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checkpoint_id: string | null;
      seconds_spoken: number;
    };
    // Converted to a checkpoint: returns checkpoint_id + segment seconds (300),
    // NOT a thread-end (which would count from thread creation and set endedAt).
    expect(body.checkpoint_id).toBe("cp1");
    expect(body.seconds_spoken).toBe(300);
  });

  it("400s a checkpoint against a non-thread (scenario/legacy) conversation", async () => {
    const convId = "11111111-1111-1111-1111-111111111111";
    const db = {
      query: {
        conversations: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: convId, userId, kind: "session" }),
        },
      },
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      `/v1/voice/sessions/${convId}/checkpoint`,
      { method: "POST" },
    );
    expect(res.status).toBe(400);
  });

  it("no-ops when the checkpoint insert loses the idempotency race", async () => {
    const convId = "11111111-1111-1111-1111-111111111111";
    const startedAt = new Date("2026-07-05T10:00:00Z");
    const newestAt = new Date("2026-07-05T10:05:00Z");
    const db = {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue({
            id: convId,
            userId,
            kind: "thread",
            language: "de",
            startedAt,
          }),
        },
        profiles: {
          findFirst: vi.fn().mockResolvedValue({
            timezone: "UTC",
            dailyGoalMinutes: 10,
            memoryEnabled: false,
            nativeLang: "en",
          }),
        },
        sessionCheckpoints: { findFirst: vi.fn().mockResolvedValue(undefined) },
        messages: {
          findFirst: vi.fn().mockResolvedValue({ createdAt: newestAt }),
        },
      },
      // A concurrent checkpoint already closed this segment → insert returns [].
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      `/v1/voice/sessions/${convId}/checkpoint`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkpoint_id: string | null };
    expect(body.checkpoint_id).toBeNull();
    // No streak upsert on the losing path.
    expect(db.execute).not.toHaveBeenCalled();
  });
});
