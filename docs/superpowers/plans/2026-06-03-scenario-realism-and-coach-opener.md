# Scenario Realism + Coach-Initiated Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make role-play scenarios feel realistic and have the coach speak the first line, generated live in character and free of quota.

**Architecture:** Rewrite the 10 scenario persona prompts and tighten the shared scenario scaffolding. Add a new free `POST /v1/voice/sessions/:id/opening` SSE endpoint that generates a system-prompt-only coach opener through the existing reply-chunk → TTS pipeline (no transcription, no quota, no usage counting). On the mobile side, add `streamOpening` and refactor `use-conversation` so the scenario branch plays a coach opener using the same audio-queue/reply-chunk handling as user turns.

**Tech Stack:** Hono + Drizzle + Zod (API), Vitest (tests), React Native + Expo (mobile), `react-native-sse`, `@language-coach/shared` workspace package.

All commands run from `app/` (the monorepo root) unless stated. Current branch: `scenario-realism-coach-opener`.

---

### Task 1: Rewrite the 10 scenario persona prompts

**Files:**

- Modify: `packages/shared/src/role-play-scenarios.ts:26-147` (the 10 `systemPromptFragment` values)
- Test: `packages/shared/src/role-play-scenarios.test.ts` (existing — no edits, must stay green)

- [ ] **Step 1: Run the existing test to confirm baseline green**

Run: `pnpm --filter @language-coach/shared test -- role-play-scenarios`
Expected: PASS (4 tests — 10 scenarios, 3 free, fragments >40 chars, unique ids)

- [ ] **Step 2: Replace each `systemPromptFragment`**

Edit `packages/shared/src/role-play-scenarios.ts`. Replace ONLY the `systemPromptFragment` string of each scenario (leave `id`, `title`, `description`, `icon`, `pro` untouched). Use exactly these strings:

`coffee`:

```
"You are Marco, the barista at a small neighbourhood café on a quiet mid-morning. You speak first: greet the customer warmly and ask what they'd like. Take their order naturally and feel free to mention the day's special. Keep your turns to a sentence or two and let them lead. If it comes up naturally, one small hiccup might surface — the card reader is playing up, or the last almond croissant just went — but don't force it. Stay relaxed and friendly."
```

`directions`:

```
"You are a friendly local out for a walk when someone stops you to ask the way to a well-known spot in town. You speak first with a warm 'Oh, hi — you look a little lost, can I help?' Give directions using real landmarks ('go past the bakery, then turn left at the church'). Be patient and happy to repeat yourself. If they ask for somewhere you genuinely wouldn't know, admit it and point them to someone who might."
```

`party`:

```
"You are Sofia, a guest at a mutual friend's birthday party, drink in hand. You speak first: introduce yourself and ask how they know the host. Keep it light and curious — find one thing you have in common (work, a hobby, a place you've both been) and dig into it. Short, casual turns; let them talk more than you do."
```

`hotel`:

```
"You are the receptionist at a mid-range city hotel. You speak first: greet the guest politely and ask for the name on the booking. Handle check-in formally but warmly. A small wrinkle may surface — the room isn't quite ready, or there's a paid upgrade available — which you raise courteously and work through together. Keep your turns brief and professional."
```

`doctor`:

```
"You are Dr. Lewis, a kind GP. You speak first: greet the patient and ask what's brought them in today. Ask gentle follow-up questions one at a time — when it started, how bad it is, whether it's happened before. Once you have a picture, give a simple diagnosis and clear instructions for a treatment (how much, how often, how long). Be patient if they search for words and never lecture."
```

`interview`:

```
"You are the hiring manager interviewing this candidate for a role in their field. You speak first: welcome them and open with something easy ('thanks for coming in — tell me a bit about yourself'). After two or three warm questions, ask one harder one (a past failure, or why they're leaving their current job) and follow up on their answer. Keep your own turns short and let them do most of the talking."
```

`complaint`:

```
"You are a customer-service agent answering the phone. You speak first with a standard greeting ('Thanks for calling support — how can I help today?'). Let the customer explain their problem. Start a little by-the-book and ask for details (order number, dates); if they make their case clearly and politely, soften and offer a fair resolution. Keep it calm and realistic, never theatrical."
```

`phone-friend`:

```
"You are Alex, a close friend the person hasn't spoken to in a few weeks, calling to catch up. You speak first: pick up warmly ('hey! it's been ages — how are you?'). Trade news using casual language and contractions. Somewhere in the chat, mention one small thing going on in your life that you'd like their take on. Keep it easy and back-and-forth."
```

`meeting`:

```
"You are Priya, chairing a small team meeting where this person is the new joiner. You speak first: welcome them to the team and invite them to introduce themselves. Ask one or two friendly questions about their background, then ask what they're looking forward to in the role. Keep it warm, brief and professional."
```

`emergency`:

```
"You are a duty officer at a police station. Someone has come in having lost their passport while travelling. You speak first: greet them calmly and ask how you can help. Take it step by step — what happened, when and where, a few identifying details, where they're staying. Stay professional and reassuring, then give clear next steps (which embassy to contact, what to bring, any fee). Keep your turns short so they can follow."
```

- [ ] **Step 3: Run the test to confirm still green**

Run: `pnpm --filter @language-coach/shared test -- role-play-scenarios`
Expected: PASS (all fragments are >40 chars, still 10 scenarios / 3 free / unique ids)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/role-play-scenarios.ts
git commit -m "feat(scenarios): rewrite persona prompts for realism + coach opens first"
```

---

### Task 2: Add "coach speaks first" to the shared scenario scaffolding

**Files:**

- Modify: `packages/shared/src/prompts.ts:68-76` (the `if (input.scenario)` return block)
- Test: `packages/shared/src/prompts.test.ts` (existing — no edits, must stay green)

- [ ] **Step 1: Run the existing test to confirm baseline green**

Run: `pnpm --filter @language-coach/shared test -- prompts`
Expected: PASS (5 tests)

- [ ] **Step 2: Add the "you speak first" scaffolding line**

In `packages/shared/src/prompts.ts`, replace the scenario return block (lines 68-76) with:

```ts
if (input.scenario) {
  return [
    input.scenario.systemPromptFragment,
    `Speak only in ${lang.englishName} (${lang.nativeName}).`,
    `You speak first: open the interaction the way your character naturally would, then respond to whatever the user actually says rather than following a fixed script.`,
    `Stay in character throughout. You are NOT a language coach — never give grammar explanations, vocabulary lessons, or meta-commentary about the user's language. If the user makes a language mistake, you may naturally rephrase or ask "did you mean X?" the way a real person might. Never explicitly correct or teach.`,
    `Keep responses short — 1-3 sentences typically, like real conversation. Be friendly when appropriate to your role, but don't be a teacher.`,
    `Never break character. Never mention being ChatGPT, GPT, OpenAI, AI, a model, Lisa, or a language coach. If asked, you are simply the character described above.`,
  ].join(" ");
}
```

- [ ] **Step 3: Run the test to confirm still green**

Run: `pnpm --filter @language-coach/shared test -- prompts`
Expected: PASS — scenario prompt still excludes "Bruno", "Your name is Lisa", "You are a kind, patient"; still includes the fragment + "Italian".

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/prompts.ts
git commit -m "feat(prompts): scenario coach speaks first and reacts to the user"
```

---

### Task 3: Backend — `POST /v1/voice/sessions/:id/opening` (TDD)

**Files:**

- Create: `apps/api/src/routes/voice-opening.test.ts`
- Modify: `apps/api/src/routes/voice.ts` (add the route inside `createVoiceRoutes`, after the `/turns` route, before `/sessions/:id/end`)

- [ ] **Step 1: Write the failing test file**

Create `apps/api/src/routes/voice-opening.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @language-coach/api test -- voice-opening`
Expected: FAIL — route does not exist yet (404 for all, or no `/opening` handler).

- [ ] **Step 3: Implement the `/opening` route**

In `apps/api/src/routes/voice.ts`, add this route inside `createVoiceRoutes`, immediately after the `/sessions/:id/turns` route closes (after line 475) and before `routes.post("/sessions/:id/end", ...)`:

```ts
// POST /sessions/:id/opening — scenario-only coach opener. The coach speaks
// the first line in character. This turn is FREE: no transcription, no quota
// check, no usage/seconds counting. Reuses the reply-chunk → TTS pipeline.
routes.post("/sessions/:id/opening", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");
  const platform = platformFromHeader(c.req.header("X-Client-Platform"));
  const onUsage = makeOnUsage(deps.db, { userId, platform, conversationId });

  const conversation = await deps.db.query.conversations.findFirst({
    where: (t, { eq: e, and: a }) =>
      a(e(t.id, conversationId), e(t.userId, userId)),
  });
  if (!conversation) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Conversation not found" } },
      404,
    );
  }
  if (!conversation.scenarioId) {
    return c.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Opening is only available for scenarios",
        },
      },
      400,
    );
  }
  const scenario = ROLE_PLAY_SCENARIOS.find(
    (s) => s.id === conversation.scenarioId,
  );
  if (!scenario) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Unknown scenario" } },
      400,
    );
  }

  const profile = await deps.db.query.profiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });
  if (!profile) {
    return c.json({ error: { code: "INTERNAL", message: "No profile" } }, 500);
  }

  // Idempotency: if this conversation already has messages, the opener was
  // already produced (double mount / retry). Emit done without regenerating.
  const existing = await deps.db.query.messages.findMany({
    where: (t, { eq: e }) => e(t.conversationId, conversationId),
    orderBy: (t, { asc: a }) => [a(t.createdAt)],
  });
  if (existing.length > 0) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          messageId: existing[existing.length - 1]?.id ?? "",
        }),
      });
    });
  }

  const sysPrompt = buildCoachSystemPrompt({
    targetLanguage: conversation.language,
    userDisplayName: profile.displayName,
    memory: null,
    scenario: {
      id: scenario.id,
      systemPromptFragment: scenario.systemPromptFragment,
    },
  });

  const languageCode = conversation.language;

  return streamSSE(c, async (stream) => {
    try {
      // System-only context: the model produces the opener because there is
      // no prior user turn.
      const gptStream = deps.streamChatCompletion({
        messages: [{ role: "system" as const, content: sysPrompt }],
        model: "gpt-4o-mini",
        onUsage,
      });

      const sentenceBuf = new SentenceBuffer();
      let chunkIndex = 0;
      const ttsPromises: Promise<void>[] = [];
      let fullCoachText = "";
      const turnSeq = Date.now();

      async function emitChunk(text: string, idx: number): Promise<void> {
        let audio: TtsResult;
        try {
          audio = await deps.synthesizeSpeech({
            text,
            languageCode,
            onUsage,
          });
        } catch {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              code: "TTS_PROVIDER_FAILURE",
              message: "TTS failed for chunk " + idx,
              retryable: true,
            }),
          });
          return;
        }
        const { audioUrl } = await deps.uploadCoachAudioChunk({
          userId,
          conversationId,
          messageId: `pending-${conversationId}-${turnSeq}`,
          chunkIndex: idx,
          audioBuffer: audio.audioBuffer,
          contentType: audio.contentType,
        });
        await stream.writeSSE({
          event: "reply-chunk",
          data: JSON.stringify({ index: idx, text, audioUrl, durationMs: 0 }),
        });
      }

      for await (const delta of gptStream) {
        fullCoachText += delta;
        const sentences = sentenceBuf.push(delta);
        for (const s of sentences) {
          const idx = chunkIndex++;
          ttsPromises.push(emitChunk(s, idx));
        }
      }
      const tail = sentenceBuf.flush();
      if (tail) {
        const idx = chunkIndex++;
        ttsPromises.push(emitChunk(tail, idx));
      }
      await Promise.all(ttsPromises);

      const [coachRow] = await deps.db
        .insert(messages)
        .values({
          conversationId,
          role: "coach",
          text: fullCoachText,
          audioStoragePath: null,
        })
        .returning();

      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ messageId: coachRow!.id }),
      });
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : "INTERNAL";
      const message = (err as Error).message ?? "Unexpected error";
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          code,
          message,
          retryable: code !== "QUOTA_EXCEEDED",
        }),
      });
    }
  });
});
```

> Note: `TtsResult`, `SentenceBuffer`, `ProviderError`, `streamSSE`, `messages`, `ROLE_PLAY_SCENARIOS`, `buildCoachSystemPrompt`, `makeOnUsage`, `platformFromHeader` are all already imported at the top of `voice.ts` (used by `/turns`). No new imports needed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @language-coach/api test -- voice-opening`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the existing voice tests to confirm no regression**

Run: `pnpm --filter @language-coach/api test -- voice`
Expected: PASS (voice-turn, voice-greeting, voice-preview, voice tests all green)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/voice.ts apps/api/src/routes/voice-opening.test.ts
git commit -m "feat(api): free scenario opener endpoint (coach speaks first)"
```

---

### Task 4: Mobile — `streamOpening` client helper

**Files:**

- Modify: `apps/mobile/src/lib/api-client.ts` (add `streamOpening` after `streamTurn`, end of file)

- [ ] **Step 1: Add `streamOpening`**

At the end of `apps/mobile/src/lib/api-client.ts`, add:

```ts
/**
 * POST to the scenario opening endpoint and consume the SSE response as an
 * AsyncIterable of TurnEvents. Same protocol as streamTurn but with NO request
 * body (no audio) and NO transcription event — the coach simply speaks first.
 */
export function streamOpening(conversationId: string): {
  events: AsyncIterable<TurnEvent>;
  close: () => void;
} {
  const url = `${API_BASE_URL}/v1/voice/sessions/${conversationId}/opening`;

  let es: EventSource<TurnEventName> | null = null;
  let open = true;
  const queue: TurnEvent[] = [];
  let resolveNext: ((e: TurnEvent | null) => void) | null = null;

  function push(e: TurnEvent) {
    if (!open) return;
    if (resolveNext) {
      resolveNext(e);
      resolveNext = null;
    } else queue.push(e);
  }

  function endStream() {
    open = false;
    es?.close();
    if (resolveNext) {
      resolveNext(null);
      resolveNext = null;
    }
  }

  void (async () => {
    let auth: string;
    try {
      auth = await authHeader();
    } catch (err) {
      push({
        type: "error",
        code: "UNAUTHORIZED",
        message: (err as Error).message,
        retryable: false,
      });
      endStream();
      return;
    }

    es = new EventSource<TurnEventName>(url, {
      method: "POST",
      headers: { authorization: auth, ...clientPlatformHeader() },
    });

    es.addEventListener("reply-chunk", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as {
        index: number;
        text: string;
        audioUrl: string;
        durationMs: number;
      };
      push({
        type: "reply-chunk",
        index: data.index,
        text: data.text,
        audioUrl: data.audioUrl,
        durationMs: data.durationMs,
      });
    });
    es.addEventListener("done", (e) => {
      if (e.data) {
        const data = JSON.parse(e.data) as { messageId: string };
        push({ type: "done", messageId: data.messageId });
      } else {
        push({ type: "done", messageId: "" });
      }
      endStream();
    });
    es.addEventListener("error", (e) => {
      const maybeData = (e as { data?: string | null }).data;
      if (maybeData) {
        try {
          const raw = JSON.parse(maybeData) as {
            code?: string;
            message?: string;
            retryable?: boolean;
          };
          push({
            type: "error",
            code: raw.code ?? "INTERNAL",
            message: raw.message ?? "Stream error",
            retryable: raw.retryable ?? false,
          });
        } catch {
          push({
            type: "error",
            code: "INTERNAL",
            message: "Stream error",
            retryable: true,
          });
        }
      } else {
        const message = (e as { message?: string }).message ?? "Stream error";
        push({ type: "error", code: "INTERNAL", message, retryable: true });
      }
      endStream();
    });
  })();

  async function* events(): AsyncIterable<TurnEvent> {
    while (open || queue.length) {
      if (queue.length) {
        const next = queue.shift()!;
        yield next;
        if (next.type === "done" || next.type === "error") return;
        continue;
      }
      const next = await new Promise<TurnEvent | null>(
        (r) => (resolveNext = r),
      );
      if (!next) return;
      yield next;
      if (next.type === "done" || next.type === "error") return;
    }
  }

  return { events: events(), close: endStream };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @language-coach/mobile exec tsc --noEmit`
Expected: PASS (no type errors). `TurnEvent`, `TurnEventName`, `EventSource`, `authHeader`, `clientPlatformHeader`, `API_BASE_URL` are all already in scope in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/api-client.ts
git commit -m "feat(mobile): streamOpening client for the scenario opener SSE"
```

---

### Task 5: Mobile — play the opener in `use-conversation`

**Files:**

- Modify: `apps/mobile/src/features/practice/use-conversation.ts`

This task (a) extracts the audio-queue factory and the coach-stream consumption loop so the opener and user turns share them, then (b) runs the opener in the scenario branch.

- [ ] **Step 1: Import `streamOpening`**

Modify the import on line 17:

```ts
import {
  startSession,
  streamTurn,
  streamOpening,
  endSession,
  type TurnEvent,
} from "@/src/lib/api-client";
```

- [ ] **Step 2: Add a shared audio-queue factory + coach-stream consumer inside the hook**

Inside `useConversation`, just before `async function start()` (line 213), add these two nested helpers. They close over `setMessages` / `setLastActivityAt`, which are already in scope:

```ts
// Single place that turns a coach SSE stream's reply-chunks into the growing
// coach message + queued audio, and resolves the server message id on done.
// Shared by user turns (stop) and the scenario opener (runOpening).
function createAudioQueue() {
  return new AudioQueue({
    playChunk: async (chunk) => {
      await playOnce({
        source: { uri: chunk.audioUrl },
        text: chunk.text,
        durationMs: chunk.durationMs,
      });
    },
  });
}

type CoachStreamOutcome =
  | { kind: "ok" }
  | { kind: "paywall" }
  | { kind: "soft-error"; code: SoftErrorCode }
  | { kind: "fatal-error"; code: string; message: string };

async function consumeCoachStream(
  events: AsyncIterable<TurnEvent>,
  audioQueue: ReturnType<typeof createAudioQueue>,
  onTranscription?: (text: string) => void,
): Promise<CoachStreamOutcome> {
  let coachMessageId: string | null = null;
  const chunkTexts: string[] = [];

  for await (const event of events) {
    if (event.type === "transcription") {
      onTranscription?.(event.text);
    } else if (event.type === "reply-chunk") {
      chunkTexts[event.index] = event.text;
      const accumText = chunkTexts.filter(Boolean).join(" ");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === "coach" &&
          coachMessageId !== null &&
          last.id === coachMessageId
        ) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: accumText, audioUrl: event.audioUrl },
          ];
        }
        const newId = `c-${Date.now()}`;
        coachMessageId = newId;
        return [
          ...prev,
          {
            id: newId,
            role: "coach",
            text: accumText,
            audioUrl: event.audioUrl,
          },
        ];
      });
      audioQueue.enqueue({
        index: event.index,
        text: event.text,
        audioUrl: event.audioUrl,
        durationMs: event.durationMs,
      });
    } else if (event.type === "done") {
      if (coachMessageId && event.messageId) {
        const serverId = event.messageId;
        const localId = coachMessageId;
        setMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, id: serverId } : m)),
        );
      }
      setLastActivityAt(Date.now());
    } else if (event.type === "error") {
      if (event.code === "DAILY_QUOTA_EXCEEDED") {
        return { kind: "paywall" };
      }
      const code = event.code as SoftErrorCode;
      if (SOFT_ERROR_CODES.has(code)) {
        pushSoftErrorAsCoachMessage(code);
        return { kind: "soft-error", code };
      }
      return {
        kind: "fatal-error",
        code: event.code,
        message: event.message,
      };
    }
  }
  return { kind: "ok" };
}

// Scenario opener: the coach speaks first. Non-fatal — whatever happens we
// land on idle so the user can start talking. Free turn (no quota).
async function runOpening(conversationId: string, isCancelled: () => boolean) {
  setState({ phase: "processing", conversationId });
  const audioQueue = createAudioQueue();
  try {
    const { events } = streamOpening(conversationId);
    await consumeCoachStream(events, audioQueue);
    await audioQueue.waitForDrain();
  } catch (err) {
    console.warn("[OPENING] failed:", err);
  }
  if (isCancelled()) return;
  setState({ phase: "idle", conversationId });
}
```

- [ ] **Step 3: Use the opener in the scenario branch of the session-start effect**

Replace lines 129-133 (the `if (scenarioId) { setMessages([]); setState(idle); return; }` block) with:

```ts
// Scenarios: the coach speaks first, in character. Play the opener
// through the same reply-chunk/audio pipeline as a normal turn.
if (scenarioId) {
  setMessages([]);
  await runOpening(conversation_id, () => cancelled);
  return;
}
```

- [ ] **Step 4: Refactor `stop()` to use the shared consumer**

Replace the body of the `try` block in `stop()` from the `const { events } = streamTurn(...)` line through the `setState({ phase: "idle", conversationId });` that follows `await audioQueue.waitForDrain();` (lines 270-370) with:

```ts
const vl = useVoiceLab.getState();
const voiceOverride = vl.overrideEnabled ? vl.config : undefined;
const { events } = streamTurn(conversationId, uri, voiceOverride);
const audioQueue = createAudioQueue();

const outcome = await consumeCoachStream(events, audioQueue, (text) => {
  setMessages((prev) => [
    ...prev,
    {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      audioUrl: uri,
      audioDurationMs: durationMs,
    },
  ]);
  setUserTurnCount((n) => n + 1);
  setLastActivityAt(Date.now());
});

if (outcome.kind === "paywall") {
  await audioQueue.waitForDrain();
  if (!paywallShownRef.current) {
    paywallShownRef.current = true;
    router.push("/(modals)/paywall");
  }
  setState({ phase: "idle", conversationId });
  return;
}
if (outcome.kind === "soft-error") {
  await audioQueue.waitForDrain();
  setState({ phase: "idle", conversationId });
  return;
}
if (outcome.kind === "fatal-error") {
  throw new Error(`${outcome.code}: ${outcome.message}`);
}

await audioQueue.waitForDrain();
paywallShownRef.current = false;
setState({ phase: "idle", conversationId });
```

> This preserves the original behavior exactly: transcription inserts the user message + bumps the turn count; `DAILY_QUOTA_EXCEEDED` drains then opens the paywall once; soft errors push a coach fallback then go idle; other errors throw to the outer catch (error screen).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @language-coach/mobile exec tsc --noEmit`
Expected: PASS. If the `consumeCoachStream` events-type inference is awkward, simplify by importing `TurnEvent` from `@/src/lib/api-client` and typing the param as `AsyncIterable<TurnEvent>` instead of the conditional-type expression — make `TurnEvent` exported there if not already (it is exported).

- [ ] **Step 6: Lint**

Run: `pnpm --filter @language-coach/mobile lint`
Expected: PASS. Note: `apps/mobile` does not load `eslint-plugin-react-hooks`; the session-start effect's dependency array is unchanged (`[targetLang, displayName, nativeLang, scenarioId]`) so no new exhaustive-deps concern arises. Do not add `react-hooks/...` disable comments.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/practice/use-conversation.ts
git commit -m "feat(mobile): coach speaks first in scenarios via shared stream consumer"
```

---

### Task 6: Full verification (keep CI green)

**Files:** none (verification only)

- [ ] **Step 1: Format**

Run: `pnpm format`
Expected: writes any formatting; re-stage if files changed.

- [ ] **Step 2: Lint the whole repo**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: PASS — including the new `voice-opening` suite and the unchanged `role-play-scenarios` / `prompts` / `voice-turn` suites.

- [ ] **Step 5: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: format" || echo "nothing to format"
```

- [ ] **Step 6: Push the feature branch**

```bash
git push -u origin scenario-realism-coach-opener
```

> Per the project's CI rule, push to this feature branch (not `main`). Open a PR once green if desired.

---

## Manual smoke test (on device, after merge to a dev build)

Not automatable here, but verify before release:

1. Start a **Coffee** scenario → the coach (Marco) greets you in the target language, audio plays, mic is disabled until he finishes, then enables.
2. Reply → normal turn flow continues.
3. End and reopen the same scenario type → opener line differs (dynamic, not canned).
4. As a **free** user already at the daily cap → starting a scenario still plays the opener (it's free); the paywall only appears when _you_ speak.
5. Kill the network at session start → opener fails silently, you land on idle and can still start speaking.
