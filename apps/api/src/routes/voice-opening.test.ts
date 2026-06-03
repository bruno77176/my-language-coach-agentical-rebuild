import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceRoutes, type VoiceDeps } from "./voice";

const userId = "00000000-0000-0000-0000-000000000001";
const conversationId = "11111111-1111-1111-1111-111111111111";
const coachMessageId = "33333333-3333-3333-3333-333333333333";

type ConversationRow = {
  id: string;
  userId: string;
  language: string;
  scenarioId: string | null;
  topicId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  secondsSpoken: number;
};

type SetupOverrides = {
  conversation?: ConversationRow | null;
  history?: Array<{ id?: string; role: "user" | "coach"; text: string }>;
  streamChatCompletion?: VoiceDeps["streamChatCompletion"];
  synthesizeSpeech?: VoiceDeps["synthesizeSpeech"];
};

function scenarioConversation(): ConversationRow {
  return {
    id: conversationId,
    userId,
    language: "es",
    scenarioId: "coffee",
    topicId: null,
    startedAt: new Date(),
    endedAt: null,
    secondsSpoken: 0,
  };
}

function setupRoute(overrides: SetupOverrides = {}) {
  const conversation =
    overrides.conversation === undefined
      ? scenarioConversation()
      : overrides.conversation;
  const history = overrides.history ?? [];

  const insertReturning = vi.fn().mockResolvedValue([{ id: coachMessageId }]);

  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const fakeDb = {
    query: {
      conversations: {
        findFirst: vi.fn().mockResolvedValue(conversation ?? undefined),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue({
          userId,
          displayName: "Bruno",
          nativeLang: "en",
          targetLang: "es",
          dailyGoalMinutes: 10,
          timezone: "UTC",
          memoryEnabled: true,
          createdAt: new Date(),
        }),
      },
      messages: {
        findMany: vi.fn().mockResolvedValue(history),
      },
      entitlements: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
      coachMemory: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    update: vi.fn(() => updateChain),
  };

  async function* defaultStream() {
    yield "Hola, ";
    yield "soy Marco.";
  }
  const streamChatCompletion =
    overrides.streamChatCompletion ??
    (vi.fn(() =>
      defaultStream(),
    ) as unknown as VoiceDeps["streamChatCompletion"]);

  const synthesizeSpeech =
    overrides.synthesizeSpeech ??
    vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from([1, 2, 3, 4]),
      contentType: "audio/mpeg",
    });

  const uploadCoachAudioChunk = vi
    .fn()
    .mockImplementation(({ chunkIndex }: { chunkIndex: number }) =>
      Promise.resolve({
        audioUrl: `https://signed.example/opening-${chunkIndex}.mp3`,
      }),
    );

  const routes = createVoiceRoutes({
    db: fakeDb as never,
    transcribeAudio: vi.fn(),
    streamChatCompletion,
    synthesizeSpeech,
    uploadCoachAudioChunk,
    extractMemory: async () => null,
    generateFeedback: async () => null,
  });

  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/voice", routes);

  return { app, fakeDb, streamChatCompletion, synthesizeSpeech, updateChain };
}

async function readSseEvents(
  body: ReadableStream<Uint8Array>,
): Promise<Array<{ event: string; data: string }>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const events: Array<{ event: string; data: string }> = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value);
    const blocks = buf.split("\n\n");
    buf = blocks.pop() ?? "";
    for (const block of blocks) {
      const lines = block.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "";
      const data = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "";
      if (event) events.push({ event, data });
    }
  }
  return events;
}

describe("POST /v1/voice/sessions/:id/opening", () => {
  it("streams an in-character coach opener (reply-chunk + done), no transcription", async () => {
    const { app, synthesizeSpeech } = setupRoute();
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/opening`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(res.body!);
    const types = events.map((e) => e.event);

    expect(types).not.toContain("transcription");
    expect(types).toContain("reply-chunk");
    expect(types).toContain("done");

    const chunks = events.filter((e) => e.event === "reply-chunk");
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const done = events.find((e) => e.event === "done");
    expect(JSON.parse(done!.data)).toEqual({ messageId: coachMessageId });

    expect(synthesizeSpeech).toHaveBeenCalled();
  });

  it("uses the saved opener line and skips the LLM for a known scenario+language", async () => {
    const { app, streamChatCompletion } = setupRoute();
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/opening`,
      { method: "POST" },
    );
    const events = await readSseEvents(res.body!);
    const chunks = events.filter((e) => e.event === "reply-chunk");
    // The saved Spanish "coffee" opener is emitted as a single chunk.
    expect(chunks).toHaveLength(1);
    expect(JSON.parse(chunks[0]!.data).text).toBe(
      "¡Buenos días! ¿Qué le pongo?",
    );
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });

  it("does not touch quota or seconds (no entitlement/conversation update)", async () => {
    const { app, fakeDb, updateChain } = setupRoute();
    await readSseEvents(
      (
        await app.request(`/v1/voice/sessions/${conversationId}/opening`, {
          method: "POST",
        })
      ).body!,
    );
    // The /turns path updates conversations + entitlements; the opener must not.
    expect(fakeDb.query.entitlements.findFirst).not.toHaveBeenCalled();
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("returns 400 when the conversation has no scenario", async () => {
    const { app } = setupRoute({
      conversation: { ...scenarioConversation(), scenarioId: null },
    });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/opening`,
      { method: "POST" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 when the conversation does not exist", async () => {
    const { app } = setupRoute({ conversation: null });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/opening`,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });

  it("is idempotent: if messages already exist, emits done without generating", async () => {
    const { app, streamChatCompletion } = setupRoute({
      history: [{ id: "old", role: "coach", text: "already said hi" }],
    });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/opening`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const events = await readSseEvents(res.body!);
    expect(events.filter((e) => e.event === "reply-chunk")).toHaveLength(0);
    expect(events.find((e) => e.event === "done")).toBeDefined();
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });
});
