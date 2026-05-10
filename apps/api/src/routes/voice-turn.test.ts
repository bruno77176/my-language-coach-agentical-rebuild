import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  createVoiceRoutes,
  type VoiceDeps,
  type UploadCoachAudioChunkFn,
} from "./voice";
import { ProviderError } from "../providers/deepgram";

const userId = "00000000-0000-0000-0000-000000000001";
const conversationId = "11111111-1111-1111-1111-111111111111";
const userMessageId = "22222222-2222-2222-2222-222222222222";
const coachMessageId = "33333333-3333-3333-3333-333333333333";

type ConversationRow = {
  id: string;
  userId: string;
  language: string;
  topicId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  secondsSpoken: number;
};

type EntitlementRow = {
  userId: string;
  plan: "free" | "pro";
  proUntil: Date | null;
  monthlyVoiceSecondsUsed: number;
  monthlyVoiceSecondsResetAt: Date;
};

type ProfileRow = {
  userId: string;
  displayName: string;
  nativeLang: string;
  targetLang: string;
  dailyGoalMinutes: number;
  timezone: string;
  createdAt: Date;
};

type SetupOverrides = {
  conversation?: ConversationRow | null;
  entitlement?: EntitlementRow | null;
  profile?: ProfileRow | null;
  history?: Array<{ role: "user" | "coach"; text: string }>;
  transcribeAudio?: VoiceDeps["transcribeAudio"];
  streamChatCompletion?: VoiceDeps["streamChatCompletion"];
  synthesizeSpeech?: VoiceDeps["synthesizeSpeech"];
  uploadCoachAudioChunk?: VoiceDeps["uploadCoachAudioChunk"];
};

function defaultConversation(): ConversationRow {
  return {
    id: conversationId,
    userId,
    language: "es",
    topicId: null,
    startedAt: new Date(),
    endedAt: null,
    secondsSpoken: 0,
  };
}

function defaultEntitlement(): EntitlementRow {
  return {
    userId,
    plan: "free",
    proUntil: null,
    monthlyVoiceSecondsUsed: 0,
    monthlyVoiceSecondsResetAt: new Date(Date.now() + 86_400_000),
  };
}

function defaultProfile(): ProfileRow {
  return {
    userId,
    displayName: "Bruno",
    nativeLang: "en",
    targetLang: "es",
    dailyGoalMinutes: 10,
    timezone: "UTC",
    createdAt: new Date(),
  };
}

function setupRoute(overrides: SetupOverrides = {}) {
  const conversation =
    overrides.conversation === undefined
      ? defaultConversation()
      : overrides.conversation;
  const entitlement =
    overrides.entitlement === undefined
      ? defaultEntitlement()
      : overrides.entitlement;
  const profile =
    overrides.profile === undefined ? defaultProfile() : overrides.profile;
  const history = overrides.history ?? [];

  const insertReturning = vi.fn();
  // Each insert(messages).values().returning() returns an array. We alternate:
  // first call -> user message id; second call -> coach message id.
  let insertCallCount = 0;
  insertReturning.mockImplementation(() => {
    insertCallCount += 1;
    if (insertCallCount === 1) {
      return Promise.resolve([{ id: userMessageId }]);
    }
    return Promise.resolve([{ id: coachMessageId }]);
  });

  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const fakeDb = {
    query: {
      conversations: {
        findFirst: vi.fn().mockResolvedValue(conversation ?? undefined),
      },
      entitlements: {
        findFirst: vi.fn().mockResolvedValue(entitlement ?? undefined),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue(profile ?? undefined),
      },
      messages: {
        findMany: vi.fn().mockResolvedValue(history),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturning })),
    })),
    update: vi.fn(() => updateChain),
  };

  const transcribeAudio =
    overrides.transcribeAudio ??
    vi.fn().mockResolvedValue({ text: "Hola", durationSeconds: 5 });

  // Default streaming generator yields a couple of deltas that form two
  // sentences once joined: "Hello world." and "How are you?"
  async function* defaultStream() {
    yield "Hello";
    yield " world.";
    yield " How are you?";
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

  // Return a unique URL per chunk based on chunkIndex.
  const defaultUploadChunk: UploadCoachAudioChunkFn = vi
    .fn()
    .mockImplementation(({ chunkIndex }: { chunkIndex: number }) =>
      Promise.resolve({
        audioUrl: `https://signed.example/chunk-${chunkIndex}.mp3`,
      }),
    );

  const uploadCoachAudioChunk =
    overrides.uploadCoachAudioChunk ?? defaultUploadChunk;

  const routes = createVoiceRoutes({
    db: fakeDb as never,
    transcribeAudio,
    streamChatCompletion,
    synthesizeSpeech,
    uploadCoachAudioChunk,
  });

  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/voice", routes);

  return {
    app,
    fakeDb,
    transcribeAudio,
    streamChatCompletion,
    synthesizeSpeech,
    uploadCoachAudioChunk,
  };
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

function makeAudioFormData(byteLength: number): FormData {
  const fd = new FormData();
  const bytes = new Uint8Array(byteLength);
  // Sprinkle non-zero data so the file is not pure zeros (cosmetic).
  for (let i = 0; i < byteLength; i++) bytes[i] = i % 256;
  const file = new File([bytes], "audio.webm", { type: "audio/webm" });
  fd.append("audio", file);
  return fd;
}

describe("POST /v1/voice/sessions/:id/turns", () => {
  it("emits transcription, reply-chunk events, and done on happy path (multi-sentence)", async () => {
    const { app, transcribeAudio, synthesizeSpeech, uploadCoachAudioChunk } =
      setupRoute();
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const events = await readSseEvents(res.body!);
    const types = events.map((e) => e.event);

    // Old events no longer present
    expect(types).not.toContain("reply-text-delta");
    expect(types).not.toContain("reply-audio");

    // New events present
    expect(types).toContain("transcription");
    expect(types).toContain("reply-chunk");
    expect(types).toContain("done");

    // Transcription text is what the STT returned.
    const transcription = events.find((e) => e.event === "transcription");
    expect(transcription).toBeDefined();
    expect(JSON.parse(transcription!.data)).toEqual({ text: "Hola" });

    // The default stream yields "Hello world." and "How are you?" as two
    // sentences. Expect two reply-chunk events with index 0 and 1.
    const chunks = events.filter((e) => e.event === "reply-chunk");
    expect(chunks).toHaveLength(2);

    const chunk0 = JSON.parse(chunks[0]!.data);
    expect(chunk0.index).toBe(0);
    expect(chunk0.text).toBe("Hello world.");
    expect(chunk0.audioUrl).toBe("https://signed.example/chunk-0.mp3");
    expect(chunk0.durationMs).toBe(0);

    const chunk1 = JSON.parse(chunks[1]!.data);
    expect(chunk1.index).toBe(1);
    expect(chunk1.text).toBe("How are you?");
    expect(chunk1.audioUrl).toBe("https://signed.example/chunk-1.mp3");

    // Done payload includes both message ids.
    const done = events.find((e) => e.event === "done");
    expect(JSON.parse(done!.data)).toEqual({
      messageId: coachMessageId,
      userMessageId: userMessageId,
    });

    // Provider deps were called.
    expect(transcribeAudio).toHaveBeenCalledOnce();
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(uploadCoachAudioChunk).toHaveBeenCalledTimes(2);
  });

  it("emits a single reply-chunk for a single-sentence GPT response", async () => {
    async function* singleSentenceStream() {
      yield "Hola amigo.";
    }
    const streamChatCompletion = vi.fn(
      () => singleSentenceStream(),
    ) as unknown as VoiceDeps["streamChatCompletion"];

    const { app } = setupRoute({ streamChatCompletion });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(200);

    const events = await readSseEvents(res.body!);
    const chunks = events.filter((e) => e.event === "reply-chunk");

    // "Hola amigo." is a complete sentence — ends at stream end so emitted by flush()
    expect(chunks).toHaveLength(1);
    const chunk = JSON.parse(chunks[0]!.data);
    expect(chunk.index).toBe(0);
    expect(chunk.text).toBe("Hola amigo.");
    expect(chunk.audioUrl).toBe("https://signed.example/chunk-0.mp3");
  });

  it("returns 422 AUDIO_TOO_SHORT when audio < 4KB", async () => {
    const { app } = setupRoute();
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(1_000),
      },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AUDIO_TOO_SHORT");
  });

  it("returns 413 AUDIO_TOO_LONG when audio > 1.5MB", async () => {
    const { app } = setupRoute();
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(1_600_000),
      },
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("AUDIO_TOO_LONG");
  });

  it("returns 429 QUOTA_EXCEEDED when entitlement near cap", async () => {
    // Free tier is 30*60 = 1800 seconds. Using 1799 + an estimated few seconds
    // (50KB audio / 16KB/s = ~4s) exceeds.
    const { app } = setupRoute({
      entitlement: {
        userId,
        plan: "free",
        proUntil: null,
        monthlyVoiceSecondsUsed: 1799,
        monthlyVoiceSecondsResetAt: new Date(Date.now() + 86_400_000),
      },
    });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("emits SSE error event when STT provider fails", async () => {
    const transcribeAudio = vi
      .fn()
      .mockRejectedValue(
        new ProviderError("STT_PROVIDER_FAILURE", 503, "Deepgram boom"),
      );
    const { app } = setupRoute({ transcribeAudio });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(200); // SSE stream itself is 200
    const events = await readSseEvents(res.body!);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    const payload = JSON.parse(errorEvent!.data);
    expect(payload.code).toBe("STT_PROVIDER_FAILURE");
    expect(payload.retryable).toBe(true);
  });

  it("emits SSE error event when TTS provider fails for a chunk", async () => {
    const synthesizeSpeech = vi
      .fn()
      .mockRejectedValue(
        new ProviderError("TTS_PROVIDER_FAILURE", 503, "ElevenLabs boom"),
      );
    const { app } = setupRoute({ synthesizeSpeech });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(200);
    const events = await readSseEvents(res.body!);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    const payload = JSON.parse(errorEvent!.data);
    expect(payload.code).toBe("TTS_PROVIDER_FAILURE");
    expect(payload.retryable).toBe(true);
  });

  it("returns 404 NOT_FOUND when conversation does not exist", async () => {
    const { app } = setupRoute({ conversation: null });
    const res = await app.request(
      `/v1/voice/sessions/${conversationId}/turns`,
      {
        method: "POST",
        body: makeAudioFormData(50_000),
      },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
