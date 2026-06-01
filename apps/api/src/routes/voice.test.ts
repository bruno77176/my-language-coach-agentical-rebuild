import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceRoutes, type VoiceDeps } from "./voice";

const userId = "00000000-0000-0000-0000-000000000001";

// Stubs for the provider deps that the POST /sessions route does not touch.
// Each test that exercises the SSE turn route in voice-turn.test.ts overrides
// these with task-specific fakes.
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

describe("POST /v1/voice/sessions", () => {
  it("creates a conversation and returns its id", async () => {
    const conversationId = "11111111-1111-1111-1111-111111111111";
    const fakeDb = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: conversationId }]),
        })),
      })),
    };
    const routes = createVoiceRoutes({
      db: fakeDb as never,
      ...noopProviderDeps,
    });
    const app = appWithVoice(routes);
    const res = await app.request("/v1/voice/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "es" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { conversation_id: string };
    expect(body.conversation_id).toBe(conversationId);
  });

  it("returns 400 when language missing", async () => {
    const routes = createVoiceRoutes({
      db: {} as never,
      ...noopProviderDeps,
    });
    const app = appWithVoice(routes);
    const res = await app.request("/v1/voice/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/voice/sessions/:id/end", () => {
  const conversationId = "11111111-1111-1111-1111-111111111111";

  function makeFakeDb(opts: {
    conversation: {
      id: string;
      userId: string;
      endedAt: Date | null;
      secondsSpoken: number;
      startedAt: Date;
    } | null;
    profile: {
      timezone: string;
      dailyGoalMinutes: number;
      memoryEnabled?: boolean;
    } | null;
  }) {
    return {
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue(opts.conversation),
        },
        profiles: {
          findFirst: vi.fn().mockResolvedValue(opts.profile),
        },
        coachMemory: { findFirst: vi.fn().mockResolvedValue(undefined) },
        messages: { findMany: vi.fn().mockResolvedValue([]) },
        sessionFeedback: { findFirst: vi.fn().mockResolvedValue(undefined) },
        // Plan 8 M5: voice.ts /end fire-and-forgets scheduleOnboardingPushes
        // which calls pushSchedule.findFirst for idempotency. Stub returns
        // a row so the scheduler short-circuits and doesn't try to insert.
        pushSchedule: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
      execute: vi.fn().mockResolvedValue([]),
    };
  }

  it("returns seconds_spoken + goal_reached=true when goal met", async () => {
    // Plan 6: seconds_spoken is wall-clock session duration computed from
    // startedAt → now, not the stored conversation.secondsSpoken. Setting
    // startedAt 700s in the past simulates a 700s session (> 10 min goal).
    const fakeDb = makeFakeDb({
      conversation: {
        id: conversationId,
        userId,
        endedAt: null,
        secondsSpoken: 0,
        startedAt: new Date(Date.now() - 700 * 1000),
      },
      profile: {
        timezone: "Europe/Paris",
        dailyGoalMinutes: 10,
        memoryEnabled: true,
      },
    });
    const routes = createVoiceRoutes({
      db: fakeDb as never,
      ...noopProviderDeps,
    });
    const app = appWithVoice(routes);
    const res = await app.request(`/v1/voice/sessions/${conversationId}/end`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      seconds_spoken: number;
      goal_reached: boolean;
    };
    expect(body.seconds_spoken).toBeGreaterThanOrEqual(700);
    expect(body.goal_reached).toBe(true);
    // Sets ended_at
    expect(fakeDb.update).toHaveBeenCalled();
    // Upserts streak_days
    expect(fakeDb.execute).toHaveBeenCalled();
  });

  it("returns goal_reached=false when below goal", async () => {
    // Session duration = 120s wall-clock (< 10 min goal)
    const fakeDb = makeFakeDb({
      conversation: {
        id: conversationId,
        userId,
        endedAt: null,
        secondsSpoken: 0,
        startedAt: new Date(Date.now() - 120 * 1000),
      },
      profile: {
        timezone: "Europe/Paris",
        dailyGoalMinutes: 10,
        memoryEnabled: true,
      },
    });
    const routes = createVoiceRoutes({
      db: fakeDb as never,
      ...noopProviderDeps,
    });
    const app = appWithVoice(routes);
    const res = await app.request(`/v1/voice/sessions/${conversationId}/end`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { goal_reached: boolean };
    expect(body.goal_reached).toBe(false);
  });

  it("returns 404 when conversation does not belong to user", async () => {
    const fakeDb = makeFakeDb({
      conversation: null,
      profile: { timezone: "UTC", dailyGoalMinutes: 10, memoryEnabled: true },
    });
    const routes = createVoiceRoutes({
      db: fakeDb as never,
      ...noopProviderDeps,
    });
    const app = appWithVoice(routes);
    const res = await app.request(`/v1/voice/sessions/${conversationId}/end`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
