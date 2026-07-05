import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
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

// A drizzle select-chain stub that resolves to `rows` at .limit().
function selectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  c.from = () => c;
  c.leftJoin = () => c;
  c.where = () => c;
  c.orderBy = () => c;
  c.limit = () => Promise.resolve(rows);
  return c;
}

describe("GET /v1/voice/sessions/recent", () => {
  it("merges checkpoints + legacy sessions newest-first with a kind tag", async () => {
    const legacy = [
      {
        id: "conv-legacy",
        language: "fr",
        scenarioId: "cafe",
        startedAt: new Date("2026-07-04T10:00:00Z"),
        endedAt: new Date("2026-07-04T10:10:00Z"),
        secondsSpoken: 600,
        feedbackStatus: "ready",
      },
    ];
    const checkpoints = [
      {
        id: "cp-new",
        conversationId: "thread-de",
        language: "de",
        startedAt: new Date("2026-07-05T09:00:00Z"),
        endedAt: new Date("2026-07-05T09:05:00Z"),
        secondsSpoken: 300,
        feedbackStatus: "pending",
      },
    ];
    let call = 0;
    const db = {
      select: vi.fn(() =>
        call++ === 0 ? selectChain(legacy) : selectChain(checkpoints),
      ),
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request("/v1/voice/sessions/recent");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{ id: string; kind: string; conversationId: string }>;
    };
    // Newest (checkpoint on 07-05) first.
    expect(body.sessions.map((s) => s.id)).toEqual(["cp-new", "conv-legacy"]);
    expect(body.sessions[0].kind).toBe("checkpoint");
    expect(body.sessions[0].conversationId).toBe("thread-de");
    expect(body.sessions[1].kind).toBe("session");
  });
});

describe("GET /v1/voice/checkpoints/:id/messages", () => {
  it("returns the segment transcript for a checkpoint", async () => {
    const db = {
      query: {
        sessionCheckpoints: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cp1",
            conversationId: "thread-de",
            language: "de",
            startedAt: new Date("2026-07-05T09:00:00Z"),
            endedAt: new Date("2026-07-05T09:05:00Z"),
          }),
        },
        messages: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "m1",
              role: "user",
              text: "hallo",
              translation: null,
              isGreeting: false,
              createdAt: new Date("2026-07-05T09:01:00Z"),
            },
          ]),
        },
      },
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      "/v1/voice/checkpoints/cp1/messages",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages: Array<{ id: string }> };
    expect(body.messages.map((m) => m.id)).toEqual(["m1"]);
  });

  it("404s when the checkpoint is not owned/found", async () => {
    const db = {
      query: {
        sessionCheckpoints: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
    };
    const routes = createVoiceRoutes({ db: db as never, ...noopProviderDeps });
    const res = await appWithVoice(routes).request(
      "/v1/voice/checkpoints/nope/messages",
    );
    expect(res.status).toBe(404);
  });
});
