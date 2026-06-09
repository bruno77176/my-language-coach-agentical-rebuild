# Plan 4 — Voice loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bruno can tap the **Practice** tab on his Android device, tap the mic, speak in his target language, hear the AI coach respond in that language with text + audio, and continue the conversation for several turns. Quota gating enforces the 30 min/month free tier. Conversation messages are persisted to Supabase.

**Architecture:** The mobile app records audio via `expo-audio`, uploads each turn as multipart to `POST /v1/voice/sessions/:id/turns` on the Hono backend, and consumes the response as a Server-Sent Events stream. The backend pipes the audio to Deepgram for transcription, the transcription + conversation history to GPT-4o-mini for the response (streamed token-by-token back to the client), and the full reply text to ElevenLabs for TTS (one shot, uploaded to Supabase Storage, URL returned in the final SSE event). Mobile plays the audio via `expo-audio`. Per-message rows are inserted into Postgres as the turn progresses.

**Tech Stack:** Hono SSE, `@deepgram/sdk`, `openai`, `elevenlabs` (the official Node SDK), `expo-audio`, `expo-file-system`, `eventsource` (SSE polyfill on RN). Quota gating uses Drizzle queries against the existing `entitlements` table.

**Working directory:** All paths in this plan are relative to `C:\Users\bruno.moise\My Language Coach - rebuild\app\` unless otherwise stated.

**Branch strategy:** Work directly on `main`. CI gates each merge. Push provider keys via `flyctl secrets set`, never to git.

**Spec reference:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md` §3 (data model — `conversations`, `messages`, `entitlements`), §4 (API surface — voice routes), §5 (the voice loop in detail — SSE protocol, error codes, quota gating).

**Carries over from Plan 3:** all 8 mobile screens use inline `StyleSheet`, not NativeWind. Continue that pattern in Plan 4 — the Practice screen will use inline styles too.

---

## Pre-flight (manual, one-time, user-only)

Before any task runs, the user (Bruno) must complete:

1. **OpenAI account + API key**
   - Sign up / log in at https://platform.openai.com.
   - Add a payment method; set a low monthly hard limit (e.g. $10) under Settings → Billing → Limits.
   - Create a new project-scoped key under Dashboard → API keys → Create new secret key, name `language-coach-prod-1`. Copy the `sk-proj-...` value.

2. **Deepgram account + API key**
   - Sign up at https://deepgram.com (free tier gives $200 credit, ~1500 hours of Nova-3 STT).
   - Console → API Keys → Create a Key, scope = `Member`, name `language-coach-prod`. Copy the value.

3. **ElevenLabs account + API key**
   - Sign up at https://elevenlabs.io. Free tier = 10,000 chars/month TTS — enough for development.
   - Profile → Settings → Workspace → Read API key. Copy.

4. **Supabase Storage bucket**
   - Supabase dashboard → Storage → Create new bucket → name `user-audio`, **Private** (not public). Create.
   - Storage → Policies → on the `user-audio` bucket, add 4 policies (one per CRUD verb) with the rule `(auth.uid()::text = (storage.foldername(name))[1])` so users can only access files in their own `<user_id>/...` folder. Plan task 13 has the SQL ready to paste.

5. **Provide secrets to the executor**
   - `OPENAI_API_KEY` (sk-proj-...)
   - `DEEPGRAM_API_KEY`
   - `ELEVENLABS_API_KEY`

Tasks 2 + 13 use these. The controller writes them to `apps/api/.env` (gitignored) and to Fly secrets.

---

## Task 1: Add API runtime dependencies for voice providers

**Files:**

- Modify: `app/apps/api/package.json`

- [ ] **Step 1: Install provider SDKs**

Run from `app/`:

```powershell
pnpm -F @language-coach/api add @deepgram/sdk openai elevenlabs
```

`@deepgram/sdk` has streaming + prerecorded clients. `openai` is the official one. `elevenlabs` is ElevenLabs' official Node SDK.

- [ ] **Step 2: Verify**

```powershell
pnpm -F @language-coach/api typecheck
```

Exits 0.

---

## Task 2: Extend env validation with provider keys

**Files:**

- Modify: `app/apps/api/src/env.ts` (add 3 keys + free quota constant)
- Modify: `app/apps/api/src/env.test.ts` (cover the new keys)
- Modify: `app/apps/api/.env.example`
- Modify: `app/apps/api/.env` (controller adds real values)

- [ ] **Step 1: Update the test (TDD)**

Add to `apps/api/src/env.test.ts` inside the existing describe:

```ts
it("requires OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY", async () => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key-stub";
  process.env.SUPABASE_SECRET_KEY = "secret-key-stub";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.SENTRY_DSN = "https://stub@sentry.io/1";
  // intentionally NOT setting the new provider keys
  await expect(async () => {
    const { loadEnv } = await import("./env");
    loadEnv();
  }).rejects.toThrow(/OPENAI_API_KEY/);
});
```

Update the existing "returns a validated env object when all vars are present" test to ALSO set the 3 new keys to stub values (so it still passes):

```ts
process.env.OPENAI_API_KEY = "sk-proj-stub";
process.env.DEEPGRAM_API_KEY = "deepgram-stub";
process.env.ELEVENLABS_API_KEY = "elevenlabs-stub";
```

Same for the "defaults PORT to 3000" test.

- [ ] **Step 2: Run, expect fail**

```powershell
pnpm -F @language-coach/api test
```

The new test fails (env doesn't enforce these yet). The "returns a validated env object" test now SHOULD also fail because of strict-required new fields once we update the schema.

- [ ] **Step 3: Update `apps/api/src/env.ts`**

Add the three keys to `EnvSchema`:

```ts
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  SENTRY_DSN: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  DEEPGRAM_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
});
```

Also add a constant nearby — used by the quota gate later:

```ts
export const FREE_TIER_VOICE_SECONDS_PER_MONTH = 30 * 60; // 30 minutes
export const MAX_TURN_AUDIO_SECONDS = 60;
export const MIN_TURN_AUDIO_SECONDS = 1;
```

- [ ] **Step 4: Re-run tests, expect green**

```powershell
pnpm -F @language-coach/api test
```

- [ ] **Step 5: Update `apps/api/.env.example`**

Append:

```
# OpenAI (https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-...

# Deepgram (https://console.deepgram.com)
DEEPGRAM_API_KEY=...

# ElevenLabs (https://elevenlabs.io/app/settings/api-keys)
ELEVENLABS_API_KEY=...
```

- [ ] **Step 6: Controller updates `apps/api/.env` with the real values**

The controller (Claude) writes the three real keys into `apps/api/.env` after Bruno provides them in chat.

---

## Task 3: Provider module — Deepgram (transcription, with TDD)

**Files:**

- Create: `app/apps/api/src/providers/deepgram.ts`
- Create: `app/apps/api/src/providers/deepgram.test.ts`

We use the **prerecorded** API (not streaming) — we send the whole audio file once, get the full transcript back. Streaming is only valuable for live captions; we already have the file.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/providers/deepgram.test.ts
import { describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./deepgram";

describe("transcribeAudio", () => {
  it("returns transcript text + duration on success", async () => {
    const fakeClient = {
      listen: {
        prerecorded: {
          transcribeFile: vi.fn().mockResolvedValue({
            result: {
              results: {
                channels: [
                  { alternatives: [{ transcript: "Hola, cómo estás?" }] },
                ],
              },
              metadata: { duration: 3.4 },
            },
            error: null,
          }),
        },
      },
    };

    const result = await transcribeAudio(fakeClient as never, {
      audioBuffer: Buffer.from("fake"),
      languageCode: "es",
    });

    expect(result.text).toBe("Hola, cómo estás?");
    expect(result.durationSeconds).toBe(3.4);
  });

  it("throws STT_PROVIDER_FAILURE when Deepgram returns an error", async () => {
    const fakeClient = {
      listen: {
        prerecorded: {
          transcribeFile: vi.fn().mockResolvedValue({
            result: null,
            error: new Error("rate limited"),
          }),
        },
      },
    };
    await expect(
      transcribeAudio(fakeClient as never, {
        audioBuffer: Buffer.from("x"),
        languageCode: "en",
      }),
    ).rejects.toMatchObject({ code: "STT_PROVIDER_FAILURE" });
  });

  it("throws AUDIO_SILENT when transcript is empty", async () => {
    const fakeClient = {
      listen: {
        prerecorded: {
          transcribeFile: vi.fn().mockResolvedValue({
            result: {
              results: {
                channels: [{ alternatives: [{ transcript: "   " }] }],
              },
              metadata: { duration: 5 },
            },
            error: null,
          }),
        },
      },
    };
    await expect(
      transcribeAudio(fakeClient as never, {
        audioBuffer: Buffer.from("x"),
        languageCode: "en",
      }),
    ).rejects.toMatchObject({ code: "AUDIO_SILENT" });
  });
});
```

- [ ] **Step 2: Confirm fail.** `pnpm -F @language-coach/api test`.

- [ ] **Step 3: Create `apps/api/src/providers/deepgram.ts`**

```ts
import type { DeepgramClient } from "@deepgram/sdk";
import { createClient } from "@deepgram/sdk";
import type { Env } from "../env";

export type TranscribeInput = {
  audioBuffer: Buffer;
  languageCode: string; // ISO 639-1 ("en", "fr", "es", ...)
};

export type TranscribeResult = {
  text: string;
  durationSeconds: number;
};

export class ProviderError extends Error {
  constructor(
    public code:
      | "STT_PROVIDER_FAILURE"
      | "LLM_PROVIDER_FAILURE"
      | "TTS_PROVIDER_FAILURE"
      | "AUDIO_SILENT"
      | "AUDIO_TOO_SHORT"
      | "AUDIO_TOO_LONG"
      | "QUOTA_EXCEEDED",
    public httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function createDeepgram(env: Env): DeepgramClient {
  return createClient(env.DEEPGRAM_API_KEY);
}

export async function transcribeAudio(
  client: DeepgramClient,
  input: TranscribeInput,
): Promise<TranscribeResult> {
  const { result, error } = await client.listen.prerecorded.transcribeFile(
    input.audioBuffer,
    {
      model: "nova-3",
      language: input.languageCode,
      smart_format: true,
      punctuate: true,
    },
  );

  if (error || !result) {
    throw new ProviderError(
      "STT_PROVIDER_FAILURE",
      503,
      `Deepgram error: ${error?.message ?? "unknown"}`,
    );
  }

  const text =
    result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  const durationSeconds = result.metadata?.duration ?? 0;

  if (!text) {
    throw new ProviderError(
      "AUDIO_SILENT",
      422,
      "Transcript was empty — likely silent audio.",
    );
  }

  return { text, durationSeconds };
}
```

- [ ] **Step 4: Re-run tests, expect green.**

---

## Task 4: Provider module — OpenAI (chat completion, streaming)

**Files:**

- Create: `app/apps/api/src/providers/openai.ts`
- Create: `app/apps/api/src/providers/openai.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/providers/openai.test.ts
import { describe, expect, it, vi } from "vitest";
import { streamChatCompletion } from "./openai";

describe("streamChatCompletion", () => {
  it("yields text deltas from the model", async () => {
    async function* fakeStream() {
      yield { choices: [{ delta: { content: "Hola" } }] };
      yield { choices: [{ delta: { content: " amigo" } }] };
      yield { choices: [{ delta: { content: "!" } }] };
    }
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(fakeStream()),
        },
      },
    };
    const deltas: string[] = [];
    for await (const delta of streamChatCompletion(fakeClient as never, {
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o-mini",
    })) {
      deltas.push(delta);
    }
    expect(deltas).toEqual(["Hola", " amigo", "!"]);
  });

  it("throws LLM_PROVIDER_FAILURE on error", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("rate limited")),
        },
      },
    };
    const stream = streamChatCompletion(fakeClient as never, {
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o-mini",
    });
    await expect(stream.next()).rejects.toMatchObject({
      code: "LLM_PROVIDER_FAILURE",
    });
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Create `apps/api/src/providers/openai.ts`**

```ts
import OpenAI from "openai";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";

export function createOpenAI(env: Env): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamInput = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
};

export async function* streamChatCompletion(
  client: OpenAI,
  input: StreamInput,
): AsyncGenerator<string> {
  let stream;
  try {
    stream = (await client.chat.completions.create({
      model: input.model ?? "gpt-4o-mini",
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      stream: true,
    })) as AsyncIterable<{
      choices: Array<{ delta: { content?: string } }>;
    }>;
  } catch (err) {
    throw new ProviderError(
      "LLM_PROVIDER_FAILURE",
      503,
      `OpenAI error: ${(err as Error).message}`,
    );
  }

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta.content;
      if (delta) yield delta;
    }
  } catch (err) {
    throw new ProviderError(
      "LLM_PROVIDER_FAILURE",
      503,
      `OpenAI stream error: ${(err as Error).message}`,
    );
  }
}
```

- [ ] **Step 4: Re-run tests.**

---

## Task 5: Provider module — ElevenLabs (TTS, single-shot)

**Files:**

- Create: `app/apps/api/src/providers/elevenlabs.ts`
- Create: `app/apps/api/src/providers/elevenlabs.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/providers/elevenlabs.test.ts
import { describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "./elevenlabs";

describe("synthesizeSpeech", () => {
  it("returns audio buffer + content type", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    async function* fakeStream() {
      yield fakeAudio;
    }
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockResolvedValue(fakeStream()),
      },
    };
    const result = await synthesizeSpeech(fakeClient as never, {
      text: "Bonjour",
      voiceId: "voice-fr",
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("throws TTS_PROVIDER_FAILURE on error", async () => {
    const fakeClient = {
      textToSpeech: {
        stream: vi.fn().mockRejectedValue(new Error("quota")),
      },
    };
    await expect(
      synthesizeSpeech(fakeClient as never, { text: "x", voiceId: "v" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Create `apps/api/src/providers/elevenlabs.ts`**

```ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Env } from "../env";
import { ProviderError } from "./deepgram";

export function createElevenLabs(env: Env): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
}

export type SynthesizeInput = {
  text: string;
  voiceId: string;
  modelId?: string;
};

export type SynthesizeResult = {
  audioBuffer: Buffer;
  contentType: string;
};

export async function synthesizeSpeech(
  client: ElevenLabsClient,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  let stream;
  try {
    stream = await client.textToSpeech.stream(input.voiceId, {
      text: input.text,
      modelId: input.modelId ?? "eleven_flash_v2_5",
      outputFormat: "mp3_44100_128",
    });
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `ElevenLabs error: ${(err as Error).message}`,
    );
  }

  const chunks: Uint8Array[] = [];
  try {
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `ElevenLabs stream error: ${(err as Error).message}`,
    );
  }

  return {
    audioBuffer: Buffer.concat(chunks),
    contentType: "audio/mpeg",
  };
}
```

- [ ] **Step 4: Add a voice-id mapping** — what voice to use per language. ElevenLabs' default voices speak English well; for other languages, use multilingual voices.

Create `apps/api/src/providers/voice-map.ts`:

```ts
// Mapping of target language -> ElevenLabs voice ID. We use the multilingual
// "Rachel" voice by default (handles all 12 supported languages reasonably).
// To customize per language, pick voice IDs from
// https://elevenlabs.io/app/voice-library?language=<code>.

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — multilingual

export function voiceIdForLanguage(_languageCode: string): string {
  // For v1, all languages use Rachel. Customize later.
  return DEFAULT_VOICE_ID;
}
```

- [ ] **Step 5: Re-run tests.**

---

## Task 6: System prompt builder + supabase storage uploader

**Files:**

- Create: `app/packages/shared/src/prompts.ts`
- Create: `app/apps/api/src/lib/storage.ts`

- [ ] **Step 1: Add `prompts.ts` to the shared package**

```ts
// packages/shared/src/prompts.ts
import { LANGUAGES } from "./languages";

export type CoachPromptInput = {
  targetLanguage: string; // ISO code
  userDisplayName: string;
};

export function buildCoachSystemPrompt({
  targetLanguage,
  userDisplayName,
}: CoachPromptInput): string {
  const lang = LANGUAGES.find((l) => l.code === targetLanguage) ?? LANGUAGES[0];
  return [
    `You are a kind, patient ${lang.englishName} language coach.`,
    `You are talking to ${userDisplayName}.`,
    `Speak only in ${lang.englishName} (${lang.nativeName}).`,
    `When the user makes a grammar or vocabulary mistake, gently correct them with a brief explanation, then continue the conversation naturally.`,
    `Keep responses short — 1-3 sentences typically — as if speaking on a video call.`,
    `Never break character. Never switch to English unless the user explicitly asks for help.`,
  ].join(" ");
}
```

Update `packages/shared/src/index.ts`:

```ts
export { identity } from "./identity";
export * from "./languages";
export * from "./prompts";
```

- [ ] **Step 2: Create the storage uploader**

```ts
// apps/api/src/lib/storage.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../env";

export function createStorageClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UploadInput = {
  userId: string;
  conversationId: string;
  messageId: string;
  audioBuffer: Buffer;
  contentType: string;
};

export async function uploadCoachAudio(
  client: SupabaseClient,
  input: UploadInput,
): Promise<{ path: string; signedUrl: string }> {
  const path = `${input.userId}/${input.conversationId}/${input.messageId}.mp3`;
  const upload = await client.storage
    .from("user-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (upload.error) {
    throw new Error(`Storage upload failed: ${upload.error.message}`);
  }
  const signed = await client.storage
    .from("user-audio")
    .createSignedUrl(path, 60 * 60); // 1 hour validity
  if (signed.error || !signed.data) {
    throw new Error(`Signed URL failed: ${signed.error?.message ?? "unknown"}`);
  }
  return { path, signedUrl: signed.data.signedUrl };
}
```

- [ ] **Step 3: Verify typecheck passes.**

---

## Task 7: POST /v1/voice/sessions (start a conversation)

**Files:**

- Create: `app/apps/api/src/routes/voice.ts`
- Create: `app/apps/api/src/routes/voice.test.ts`
- Modify: `app/apps/api/src/app.ts` (mount the routes behind the auth middleware)

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/routes/voice.test.ts
import { describe, expect, it, vi } from "vitest";
import { createVoiceRoutes } from "./voice";
import { Hono } from "hono";

const userId = "00000000-0000-0000-0000-000000000001";

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
    const routes = createVoiceRoutes({ db: fakeDb as never } as never);
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
    const routes = createVoiceRoutes({ db: {} } as never);
    const app = appWithVoice(routes);
    const res = await app.request("/v1/voice/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Create `apps/api/src/routes/voice.ts`** (just the start-session route for now; turns + end come in later tasks)

```ts
import { Hono } from "hono";
import { z } from "zod";
import { conversations } from "../db/schema";
import type { Database } from "../db";

export type VoiceDeps = {
  db: Database;
};

const StartSessionBody = z.object({
  language: z.string().min(2).max(8),
  topic_id: z.string().uuid().optional(),
});

export function createVoiceRoutes(deps: VoiceDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  routes.post("/sessions", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = StartSessionBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }

    const inserted = await deps.db
      .insert(conversations)
      .values({
        userId,
        language: parsed.data.language,
        topicId: parsed.data.topic_id ?? null,
      })
      .returning({ id: conversations.id });

    return c.json({ conversation_id: inserted[0]!.id });
  });

  return routes;
}
```

- [ ] **Step 4: Wire into `apps/api/src/app.ts`**

Add to imports + after the existing health route mount:

```ts
import { createAuthMiddleware } from "./middleware/auth";
import { createSupabaseVerifier } from "./lib/supabase-verifier";
import { createVoiceRoutes } from "./routes/voice";

// Inside createApp(env, db?):
const verify = createSupabaseVerifier(env);
const auth = createAuthMiddleware(verify);

// Voice routes are auth-required.
app.use("/v1/*", auth);
app.route("/v1/voice", createVoiceRoutes({ db }));
```

- [ ] **Step 5: Re-run tests.**

---

## Task 8: Quota gating helper

**Files:**

- Create: `app/apps/api/src/lib/quota.ts`
- Create: `app/apps/api/src/lib/quota.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/lib/quota.test.ts
import { describe, expect, it } from "vitest";
import { canUseSeconds } from "./quota";
import { FREE_TIER_VOICE_SECONDS_PER_MONTH } from "../env";

describe("canUseSeconds", () => {
  it("allows pro users always", () => {
    const future = new Date(Date.now() + 86400000);
    expect(
      canUseSeconds(
        {
          plan: "pro",
          proUntil: future,
          monthlyVoiceSecondsUsed: 999999,
        },
        60,
      ),
    ).toEqual({ allowed: true });
  });

  it("treats expired pro as free", () => {
    const past = new Date(Date.now() - 86400000);
    const r = canUseSeconds(
      {
        plan: "pro",
        proUntil: past,
        monthlyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_MONTH + 1,
      },
      1,
    );
    expect(r.allowed).toBe(false);
  });

  it("allows free user under the cap", () => {
    expect(
      canUseSeconds(
        { plan: "free", proUntil: null, monthlyVoiceSecondsUsed: 600 },
        30,
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects free user over the cap", () => {
    const r = canUseSeconds(
      {
        plan: "free",
        proUntil: null,
        monthlyVoiceSecondsUsed: FREE_TIER_VOICE_SECONDS_PER_MONTH - 5,
      },
      30,
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("QUOTA_EXCEEDED");
  });
});
```

- [ ] **Step 2: Confirm fail.**

- [ ] **Step 3: Create `apps/api/src/lib/quota.ts`**

```ts
import { FREE_TIER_VOICE_SECONDS_PER_MONTH } from "../env";

export type Entitlement = {
  plan: "free" | "pro";
  proUntil: Date | null;
  monthlyVoiceSecondsUsed: number;
};

export type CanUseResult =
  | { allowed: true }
  | { allowed: false; reason: "QUOTA_EXCEEDED"; resetAt?: Date };

export function canUseSeconds(
  entitlement: Entitlement,
  estimatedSeconds: number,
): CanUseResult {
  const now = new Date();
  const isActivePro =
    entitlement.plan === "pro" &&
    entitlement.proUntil !== null &&
    entitlement.proUntil > now;
  if (isActivePro) return { allowed: true };

  const wouldUse = entitlement.monthlyVoiceSecondsUsed + estimatedSeconds;
  if (wouldUse <= FREE_TIER_VOICE_SECONDS_PER_MONTH) {
    return { allowed: true };
  }
  return { allowed: false, reason: "QUOTA_EXCEEDED" };
}
```

- [ ] **Step 4: Re-run tests.**

---

## Task 9: POST /v1/voice/sessions/:id/turns (the SSE pipeline)

**Files:**

- Modify: `app/apps/api/src/routes/voice.ts` (add the turn route)
- Create: `app/apps/api/src/routes/voice-turn.test.ts` (separate file, lots of test setup)

This is the most complex single piece of the plan. The route:

1. Loads the conversation + verifies it belongs to the user.
2. Loads the user's profile + entitlement.
3. Reads the audio body (multipart) into a Buffer; rejects if too short / too long.
4. Estimates duration; quota gate.
5. Calls Deepgram → transcript + actual duration.
6. Inserts the user's `messages` row with the transcript.
7. Uploads the user's audio to Supabase Storage (fire-and-forget; failure logs but doesn't block).
8. Loads the conversation history from DB.
9. Builds the system prompt + history.
10. Streams GPT-4o-mini, emits `reply-text-delta` SSE events for each chunk, accumulates the full reply text.
11. Calls ElevenLabs once with the full reply.
12. Uploads coach audio to Storage, gets a signed URL.
13. Inserts the coach's `messages` row with the full text and audio URL.
14. Increments `entitlements.monthly_voice_seconds_used` by actual user audio duration.
15. Updates `conversations.seconds_spoken`.
16. Emits the final `reply-audio` + `done` events; ends the stream.

The error events are emitted on any step's failure with the appropriate code.

- [ ] **Step 1: Test scaffold (the first test — happy path)**

Create `apps/api/src/routes/voice-turn.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceRoutes } from "./voice";

const userId = "00000000-0000-0000-0000-000000000001";

function makeMultipartFromBuffer(buf: Buffer): FormData {
  const form = new FormData();
  form.append("audio", new Blob([buf], { type: "audio/m4a" }), "recording.m4a");
  return form;
}

describe("POST /v1/voice/sessions/:id/turns", () => {
  it("happy path emits transcription, reply-text-delta, reply-audio, done events", async () => {
    // Stub everything: DB queries, Deepgram, OpenAI, ElevenLabs, storage.
    const conversation = {
      id: "conv-1",
      userId,
      language: "es",
      topicId: null,
    };
    const profile = {
      userId,
      displayName: "Bruno",
      targetLang: "es",
      nativeLang: "en",
    };
    const entitlement = {
      userId,
      plan: "free" as const,
      proUntil: null,
      monthlyVoiceSecondsUsed: 0,
      monthlyVoiceSecondsResetAt: new Date(),
    };

    const fakeDb = {
      // Simulate the calls the route makes; we pattern-match what the real
      // route does. See voice.ts implementation.
      query: {
        conversations: {
          findFirst: vi.fn().mockResolvedValue(conversation),
        },
        profiles: { findFirst: vi.fn().mockResolvedValue(profile) },
        entitlements: { findFirst: vi.fn().mockResolvedValue(entitlement) },
        messages: { findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "msg-1" }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    };

    const fakeDeepgram = {
      /* see Step 3 */
    };
    const fakeOpenAI = {
      /* see Step 3 */
    };
    const fakeElevenLabs = {
      /* see Step 3 */
    };
    const fakeStorage = {
      /* see Step 3 */
    };

    const routes = createVoiceRoutes({
      db: fakeDb as never,
      deepgram: fakeDeepgram as never,
      openai: fakeOpenAI as never,
      elevenlabs: fakeElevenLabs as never,
      storage: fakeStorage as never,
    });

    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", userId);
      await next();
    });
    app.route("/v1/voice", routes);

    const audio = Buffer.alloc(20_000); // 20KB ~ 2.5s of audio
    const res = await app.request("/v1/voice/sessions/conv-1/turns", {
      method: "POST",
      body: makeMultipartFromBuffer(audio),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Read the stream events.
    const events = await readSseEvents(res.body!);
    const eventNames = events.map((e) => e.event);
    expect(eventNames).toContain("transcription");
    expect(eventNames).toContain("reply-text-delta");
    expect(eventNames).toContain("reply-audio");
    expect(eventNames).toContain("done");
  });
});

async function readSseEvents(
  body: ReadableStream,
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
```

- [ ] **Step 2: Add fakes for the providers in the test**

Replace the `/* see Step 3 */` placeholders with the same fake-client objects you used in the dedicated provider tests (Tasks 3-5). For brevity, just stub the methods called by the route — `transcribeAudio` style fakes that return a `{ text, durationSeconds }` directly, etc. The route receives the real provider functions as deps but tests stub them at one level higher.

To make this tractable, change the deps signature of `createVoiceRoutes` to accept _function_ deps rather than client objects:

```ts
export type VoiceDeps = {
  db: Database;
  transcribeAudio: typeof import("../providers/deepgram").transcribeAudio;
  streamChatCompletion: typeof import("../providers/openai").streamChatCompletion;
  synthesizeSpeech: typeof import("../providers/elevenlabs").synthesizeSpeech;
  uploadCoachAudio: typeof import("../lib/storage").uploadCoachAudio;
};
```

Then in tests, stub each function inline. Cleaner.

- [ ] **Step 3: Implement the route in `apps/api/src/routes/voice.ts`**

Append to the existing file (don't rewrite the start-session route):

```ts
// (extend imports)
import { eq, and, asc } from "drizzle-orm";
import { messages, profiles, entitlements } from "../db/schema";
import { buildCoachSystemPrompt } from "@language-coach/shared";
import { MAX_TURN_AUDIO_SECONDS, MIN_TURN_AUDIO_SECONDS } from "../env";
import { canUseSeconds } from "../lib/quota";
import { ProviderError } from "../providers/deepgram";
import { voiceIdForLanguage } from "../providers/voice-map";
import { streamSSE } from "hono/streaming";

// inside createVoiceRoutes(deps):

routes.post("/sessions/:id/turns", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  // Load conversation + verify ownership.
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

  // Multipart audio body
  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get("audio");
  if (!(file instanceof File)) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "Missing audio" } },
      400,
    );
  }
  const audioBuffer = Buffer.from(await file.arrayBuffer());

  // Quick size guard (very rough — ~16kb/s for 16kHz mono PCM, MP3 is smaller).
  if (audioBuffer.byteLength > 1_500_000) {
    return c.json(
      { error: { code: "AUDIO_TOO_LONG", message: "Max 60s" } },
      413,
    );
  }
  if (audioBuffer.byteLength < 4_000) {
    return c.json(
      { error: { code: "AUDIO_TOO_SHORT", message: "Min 1s" } },
      422,
    );
  }

  // Quota check (server-side estimate — refines after STT)
  const entitlement = await deps.db.query.entitlements.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });
  if (!entitlement) {
    return c.json(
      { error: { code: "INTERNAL", message: "No entitlement" } },
      500,
    );
  }
  const estimateSeconds = Math.ceil(audioBuffer.byteLength / 16_000); // very rough
  const quotaCheck = canUseSeconds(entitlement, estimateSeconds);
  if (!quotaCheck.allowed) {
    return c.json(
      { error: { code: "QUOTA_EXCEEDED", message: "Free tier exhausted" } },
      429,
    );
  }

  const profile = await deps.db.query.profiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });
  if (!profile) {
    return c.json({ error: { code: "INTERNAL", message: "No profile" } }, 500);
  }

  return streamSSE(c, async (stream) => {
    try {
      // 1. Transcribe
      const stt = await deps.transcribeAudio({
        audioBuffer,
        languageCode: conversation.language,
      } as never);
      await stream.writeSSE({
        event: "transcription",
        data: JSON.stringify({ text: stt.text }),
      });

      // Bounds check on actual duration
      if (stt.durationSeconds > MAX_TURN_AUDIO_SECONDS) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            code: "AUDIO_TOO_LONG",
            message: "Max 60s",
            retryable: false,
          }),
        });
        return;
      }
      if (stt.durationSeconds < MIN_TURN_AUDIO_SECONDS) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            code: "AUDIO_TOO_SHORT",
            message: "Min 1s",
            retryable: true,
          }),
        });
        return;
      }

      // 2. Insert user message
      const [userMsg] = await deps.db
        .insert(messages)
        .values({ conversationId, role: "user", text: stt.text })
        .returning({ id: messages.id });

      // 3. Build prompt + history
      const history = await deps.db.query.messages.findMany({
        where: (t, { eq: e }) => e(t.conversationId, conversationId),
        orderBy: (t, { asc: a }) => [a(t.createdAt)],
      });
      const sysPrompt = buildCoachSystemPrompt({
        targetLanguage: conversation.language,
        userDisplayName: profile.displayName,
      });
      const promptMessages = [
        { role: "system" as const, content: sysPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.text,
        })),
      ];

      // 4. Stream GPT
      let fullReply = "";
      for await (const delta of deps.streamChatCompletion({
        messages: promptMessages,
        model: "gpt-4o-mini",
      } as never)) {
        fullReply += delta;
        await stream.writeSSE({
          event: "reply-text-delta",
          data: JSON.stringify({ delta }),
        });
      }

      // 5. Synthesize TTS
      const tts = await deps.synthesizeSpeech({
        text: fullReply,
        voiceId: voiceIdForLanguage(conversation.language),
      } as never);

      // 6. Insert coach message + upload audio
      const [coachMsg] = await deps.db
        .insert(messages)
        .values({ conversationId, role: "coach", text: fullReply })
        .returning({ id: messages.id });

      const upload = await deps.uploadCoachAudio({
        userId,
        conversationId,
        messageId: coachMsg!.id,
        audioBuffer: tts.audioBuffer,
        contentType: tts.contentType,
      });

      // 7. Update conversation seconds + entitlement
      await deps.db
        .update(conversations)
        .set({
          secondsSpoken:
            (conversation.secondsSpoken ?? 0) + Math.round(stt.durationSeconds),
        })
        .where(eq(conversations.id, conversationId));
      await deps.db
        .update(entitlements)
        .set({
          monthlyVoiceSecondsUsed:
            entitlement.monthlyVoiceSecondsUsed +
            Math.round(stt.durationSeconds),
        })
        .where(eq(entitlements.userId, userId));

      // 8. Final events
      await stream.writeSSE({
        event: "reply-audio",
        data: JSON.stringify({ audioUrl: upload.signedUrl, durationMs: 0 }),
      });
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ messageId: coachMsg!.id }),
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

- [ ] **Step 4: Wire the deps into `createApp`**

In `apps/api/src/app.ts`:

```ts
import { createDeepgram, transcribeAudio } from "./providers/deepgram";
import { createOpenAI, streamChatCompletion } from "./providers/openai";
import { createElevenLabs, synthesizeSpeech } from "./providers/elevenlabs";
import { createStorageClient, uploadCoachAudio } from "./lib/storage";

// Inside createApp:
const deepgram = createDeepgram(env);
const openai = createOpenAI(env);
const elevenlabs = createElevenLabs(env);
const storage = createStorageClient(env);

app.route(
  "/v1/voice",
  createVoiceRoutes({
    db,
    transcribeAudio: (input) => transcribeAudio(deepgram, input),
    streamChatCompletion: (input) => streamChatCompletion(openai, input),
    synthesizeSpeech: (input) => synthesizeSpeech(elevenlabs, input),
    uploadCoachAudio: (input) => uploadCoachAudio(storage, input),
  }),
);
```

- [ ] **Step 5: Re-run tests, expect green.**

- [ ] **Step 6: Add 4 more tests for the SSE error paths**

(Same `voice-turn.test.ts` file, additional `it()` blocks):

- AUDIO_TOO_SHORT when audio < 4KB
- AUDIO_TOO_LONG when audio > 1.5MB
- QUOTA_EXCEEDED when entitlement is over the cap (429)
- STT_PROVIDER_FAILURE when transcribeAudio throws — error event in stream

These prove every code path in §5 of the spec is reachable.

---

## Task 10: POST /v1/voice/sessions/:id/end

Finalize the conversation: set `ended_at`, update `streak_days` for today.

**Files:**

- Modify: `app/apps/api/src/routes/voice.ts` (add the end route)
- Modify: `app/apps/api/src/routes/voice.test.ts` (add tests)

- [ ] **Step 1: Add a failing test**

```ts
it("POST /v1/voice/sessions/:id/end finalizes and returns streak", async () => {
  // Stub db: returns conversation, updates conversations + streak_days,
  // returns updated streak from RPC
  // ...
});
```

- [ ] **Step 2: Add the route**

```ts
routes.post("/sessions/:id/end", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const conversation = await deps.db.query.conversations.findFirst({
    where: (t, { eq: e, and: a }) =>
      a(e(t.id, conversationId), e(t.userId, userId)),
  });
  if (!conversation) {
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  }

  const profile = await deps.db.query.profiles.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });
  if (!profile) {
    return c.json({ error: { code: "INTERNAL" } }, 500);
  }

  // Set ended_at
  await deps.db
    .update(conversations)
    .set({ endedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  // Upsert streak_days for today (in user's tz)
  const todayInTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: profile.timezone,
  }).format(new Date()); // YYYY-MM-DD

  const dailyGoalSeconds = profile.dailyGoalMinutes * 60;
  const goalReached = (conversation.secondsSpoken ?? 0) >= dailyGoalSeconds;

  // ON CONFLICT: increment seconds, OR-set goal_reached
  await deps.db.execute(sql`
    INSERT INTO streak_days (user_id, date, seconds_spoken, goal_reached)
    VALUES (${userId}, ${todayInTz}, ${conversation.secondsSpoken ?? 0}, ${goalReached})
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      seconds_spoken = streak_days.seconds_spoken + ${conversation.secondsSpoken ?? 0},
      goal_reached = streak_days.goal_reached OR ${goalReached}
  `);

  return c.json({
    seconds_spoken: conversation.secondsSpoken ?? 0,
    goal_reached: goalReached,
  });
});
```

(`current_streak` Postgres function call is in Plan 5 when we surface streaks in the UI.)

- [ ] **Step 3: Re-run tests.**

---

## Task 11: Lint + commit + deploy + verify on Fly

- [ ] **Step 1: Lint cleanup**

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

All exit 0.

- [ ] **Step 2: Set the new Fly secrets**

```powershell
flyctl secrets set --app my-language-coach-agentical-rebuild `
  OPENAI_API_KEY="sk-proj-..." `
  DEEPGRAM_API_KEY="..." `
  ELEVENLABS_API_KEY="..."
```

The next CI deploy will pick them up. Or trigger a deploy manually.

- [ ] **Step 3: Commit + push**

Standard commit (use heredoc / temp file as in earlier plans). Refer to the message style of Plan 3's final commit.

- [ ] **Step 4: Watch CI pass + deploy succeed**

```powershell
gh run watch --repo bruno77176/my-language-coach-agentical-rebuild
```

Wait for both `CI` and `API Deploy` workflows to be green.

- [ ] **Step 5: Smoke-test the live endpoint with curl**

Get a Supabase JWT for Bruno's account (sign in via the mobile app, copy the token from Metro logs; or use the supabase admin API to mint one):

```powershell
curl -X POST https://my-language-coach-agentical-rebuild.fly.dev/v1/voice/sessions `
  -H "Authorization: Bearer $JWT" `
  -H "Content-Type: application/json" `
  -d '{"language":"es"}'
```

Expected: `{"conversation_id":"...uuid..."}`. If 401, JWT is invalid. If 500, check Fly logs.

---

## Task 12: Mobile — install audio modules + audio session hook

**Files:**

- Modify: `app/apps/mobile/package.json` (add expo-audio)
- Create: `app/apps/mobile/src/lib/audio-session.ts`
- Create: `app/apps/mobile/src/lib/audio-session.test.ts`

`expo-av` is being deprecated in favor of `expo-audio` (recording) + `expo-video` (playback) starting SDK 53+. We use `expo-audio` for both recording and playback in this plan.

- [ ] **Step 1: Install**

```powershell
pnpm -F @language-coach/mobile exec npx expo install expo-audio
```

- [ ] **Step 2: Create the audio session hook**

```ts
// apps/mobile/src/lib/audio-session.ts
import { useEffect } from "react";
import { setAudioModeAsync, type AudioMode } from "expo-audio";

const RECORD_MODE: Partial<AudioMode> = {
  allowsRecording: true,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
};

const PLAYBACK_MODE: Partial<AudioMode> = {
  allowsRecording: false,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
};

export async function configureForRecording() {
  await setAudioModeAsync(RECORD_MODE as AudioMode);
}
export async function configureForPlayback() {
  await setAudioModeAsync(PLAYBACK_MODE as AudioMode);
}

// Hook to call once on mount; sets baseline (playback) mode.
export function useAudioSessionInit() {
  useEffect(() => {
    void configureForPlayback();
  }, []);
}
```

(No unit test — pure config wrapper. The contract is enforced at use sites.)

- [ ] **Step 3: Verify typecheck.**

---

## Task 13: Supabase Storage bucket + policies (manual setup, then verify)

- [ ] **Step 1: Bruno creates the `user-audio` bucket** (per Pre-flight step 4).

- [ ] **Step 2: Apply storage policies via the Supabase SQL editor** — paste this into the SQL editor and run:

```sql
-- Read own audio files
CREATE POLICY "user-audio read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Insert (upload) own audio
CREATE POLICY "user-audio insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Update own audio
CREATE POLICY "user-audio update own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete own audio
CREATE POLICY "user-audio delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

- [ ] **Step 3: Verify** — the verify-migrations script (or a quick query) shows 4 storage policies.

---

## Task 14: Mobile — API client for voice routes

**Files:**

- Create: `app/apps/mobile/src/lib/api-client.ts`
- Create: `app/apps/mobile/src/lib/api-client.test.ts`

The HTTP client needs:

- A getter for the current Supabase JWT
- Typed helpers for the voice endpoints
- An SSE consumer that yields events from the turns endpoint

- [ ] **Step 1: Add the SSE polyfill**

React Native doesn't have native EventSource. Use `react-native-sse`:

```powershell
pnpm -F @language-coach/mobile add react-native-sse
```

- [ ] **Step 2: Create the API client**

```ts
// apps/mobile/src/lib/api-client.ts
import EventSource from "react-native-sse";
import { supabase } from "./supabase";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://my-language-coach-agentical-rebuild.fly.dev";

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  return `Bearer ${data.session.access_token}`;
}

export type StartSessionResponse = { conversation_id: string };

export async function startSession(
  language: string,
): Promise<StartSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/sessions`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) throw new Error(`startSession ${res.status}`);
  return res.json();
}

export type EndSessionResponse = {
  seconds_spoken: number;
  goal_reached: boolean;
};

export async function endSession(
  conversationId: string,
): Promise<EndSessionResponse> {
  const res = await fetch(
    `${API_BASE_URL}/v1/voice/sessions/${conversationId}/end`,
    { method: "POST", headers: { authorization: await authHeader() } },
  );
  if (!res.ok) throw new Error(`endSession ${res.status}`);
  return res.json();
}

export type TurnEvent =
  | { type: "transcription"; text: string }
  | { type: "reply-text-delta"; delta: string }
  | { type: "reply-audio"; audioUrl: string; durationMs: number }
  | { type: "done"; messageId: string }
  | { type: "error"; code: string; message: string; retryable: boolean };

export function streamTurn(
  conversationId: string,
  audioUri: string,
): {
  events: AsyncIterable<TurnEvent>;
  close: () => void;
} {
  // Construct multipart body using FormData (RN supports it for fetch).
  const form = new FormData();
  // @ts-expect-error — RN's FormData type-mismatch on the file part is benign
  form.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  });

  const url = `${API_BASE_URL}/v1/voice/sessions/${conversationId}/turns`;

  let resolveAuth: () => void;
  const ready = new Promise<void>((r) => (resolveAuth = r));
  let es: EventSource | null = null;

  authHeader().then((auth) => {
    es = new EventSource(url, {
      method: "POST",
      headers: { authorization: auth },
      body: form,
    });
    resolveAuth();
  });

  async function* events(): AsyncIterable<TurnEvent> {
    await ready;
    if (!es) return;
    const queue: TurnEvent[] = [];
    let resolveNext: ((e: TurnEvent | null) => void) | null = null;

    function push(e: TurnEvent) {
      if (resolveNext) {
        resolveNext(e);
        resolveNext = null;
      } else queue.push(e);
    }

    es.addEventListener("transcription", (e) => {
      const data = JSON.parse((e as never as { data: string }).data) as {
        text: string;
      };
      push({ type: "transcription", text: data.text });
    });
    es.addEventListener("reply-text-delta", (e) => {
      const data = JSON.parse((e as never as { data: string }).data) as {
        delta: string;
      };
      push({ type: "reply-text-delta", delta: data.delta });
    });
    es.addEventListener("reply-audio", (e) => {
      const data = JSON.parse((e as never as { data: string }).data) as {
        audioUrl: string;
        durationMs: number;
      };
      push({
        type: "reply-audio",
        audioUrl: data.audioUrl,
        durationMs: data.durationMs,
      });
    });
    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as never as { data: string }).data) as {
        messageId: string;
      };
      push({ type: "done", messageId: data.messageId });
      es!.close();
      if (resolveNext) {
        resolveNext(null);
        resolveNext = null;
      }
    });
    es.addEventListener("error", (e) => {
      const raw = (e as never as { data?: string }).data;
      if (raw) {
        const data = JSON.parse(raw) as {
          code: string;
          message: string;
          retryable: boolean;
        };
        push({ type: "error", ...data });
      } else {
        push({
          type: "error",
          code: "INTERNAL",
          message: "Stream error",
          retryable: true,
        });
      }
      es!.close();
      if (resolveNext) {
        resolveNext(null);
        resolveNext = null;
      }
    });

    while (true) {
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

  return {
    events: events(),
    close: () => es?.close(),
  };
}
```

(Yes, the SSE generator is gnarly. RN's EventSource is callback-based; we wrap it as an async iterable. If this becomes painful, we can refactor in Plan 7.)

- [ ] **Step 3: Skip unit tests for the SSE client** — too much network mocking for Plan 4. The real test is the on-device run in Task 16.

---

## Task 15: Mobile — Practice screen

**Files:**

- Replace: `app/apps/mobile/app/(tabs)/practice.tsx`
- Create: `app/apps/mobile/src/features/practice/recording-store.ts`
- Create: `app/apps/mobile/src/features/practice/use-conversation.ts`

Behavior:

- On mount, call `startSession(targetLang)` and store `conversationId`.
- Show a chat list (FlatList of messages), an avatar/spinner, and a mic button at the bottom.
- Tap mic → `configureForRecording()` → start recording.
- Tap mic again → stop recording, get audio URI → `streamTurn(conversationId, audioUri)`.
- As `transcription` event arrives, append a user message bubble.
- As `reply-text-delta` events arrive, append/extend a coach message bubble live.
- As `reply-audio` arrives, `configureForPlayback()` → load + play the audio.
- On `done`, ready for next turn.
- On `error`, show a toast / inline error and re-enable mic.
- Exit button on the screen header → `endSession()` → navigate to home.

For brevity, I won't include the full ~300 lines of code here. The implementation should:

- Use `expo-audio`'s `useAudioRecorder` hook for recording (returns uri after stop).
- Use `expo-audio`'s `useAudioPlayer` hook (or `createAudioPlayer`) for playback.
- Use the `useConversation` hook (Task 15 step 3) to encapsulate the API + state machine.
- Use **inline StyleSheet** styling (same pattern as Plan 3's other screens).

Subagent should use the spec's §5 sequence diagram as the contract and the api-client's `streamTurn` as the data source.

- [ ] **Step 1: Recording store** (Zustand) — currently-recording flag, current audio URI.

- [ ] **Step 2: `use-conversation` hook** — starts the session on mount, exposes `messages`, `recording`, `processing`, `start()`, `stop()`, `end()`.

- [ ] **Step 3: Practice screen UI** — wires the hook to a FlatList of messages + a mic TouchableOpacity. Inline styles.

- [ ] **Step 4: Verify locally** — `pnpm typecheck && pnpm lint && pnpm test` all green.

---

## Task 16: Bruno tests on device + commit

- [ ] **Step 1: Reload the dev client + walk a conversation**

Bruno:

1. Phone connected via USB, Metro running, ADB reverse active (per `apps/mobile/DEV.md`).
2. Open app → sign in → home → tap **Practice** tab.
3. App calls `startSession`. Tap mic.
4. Speak in target language for 2-5 seconds.
5. Tap mic again.
6. Watch chat: user bubble appears (transcript), coach bubble grows (text delta), audio plays.
7. Continue 3-5 turns.
8. Tap exit → conversation ends → back to home.

If anything errors, the on-screen toast tells you what (e.g. "QUOTA_EXCEEDED", "Connection trouble — tap mic to retry"). Iterate on whichever provider is failing.

- [ ] **Step 2: Verify in Supabase** — Table Editor → conversations → see your conversation row with seconds_spoken populated. Messages → 6-10 rows for your turns.

- [ ] **Step 3: Verify in Supabase** — Storage → user-audio bucket → see `<userId>/<conversationId>/<messageId>.mp3` files.

- [ ] **Step 4: Verify quota** — entitlements row → `monthly_voice_seconds_used` incremented.

- [ ] **Step 5: Commit + push + verify CI/Deploy green.**

---

## Plan completion checklist

- [ ] `/v1/voice/sessions`, `/v1/voice/sessions/:id/turns`, `/v1/voice/sessions/:id/end` deployed and reachable on Fly.
- [ ] All 6 SSE events (`transcription`, `reply-text-delta`, `reply-audio`, `done`, `error`) emit correctly.
- [ ] Audio uploads to Supabase Storage in `<userId>/<conversationId>/<messageId>.mp3` form.
- [ ] Free-tier quota gate enforced — tested by manually setting `monthly_voice_seconds_used` to near-cap and seeing 429.
- [ ] Bruno can hold a multi-turn conversation in his target language on device.
- [ ] Conversation rows + messages persisted in Postgres.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` all green.
- [ ] CI green on the latest `main` commit.
- [ ] API Deploy workflow green.

---

## What's deliberately NOT in Plan 4

- **No voice activity detection.** Push-to-talk only.
- **No per-sentence streaming TTS.** Full-reply TTS once, after GPT done.
- **No conversation resume across app launches.** Cleanup cron runs daily.
- **No translation / vocab / topic features.** All Plan 5/6.
- **No rate limiting middleware.** Add in Plan 7 when we lock down for production.
- **No fallback STT/LLM/TTS providers.** Single provider per stage.
- **No client-side silence detection.** Server enforces minimum audio length.
- **No real-time API.** OpenAI Realtime for sub-second voice is reserved for the paid-tier upgrade in Plan 7+ post-launch.
