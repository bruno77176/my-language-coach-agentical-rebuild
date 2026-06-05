# Live Voice Mode — Plan A: Backend WS + Deepgram Streaming Relay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/v1/voice/live` WebSocket route that relays mobile mic audio to Deepgram streaming STT and, on each end-of-utterance, runs the existing LLM→TTS cascade and streams coach audio back — gated to allowlisted users, fully CI-testable with no device.

**Architecture:** New WS layer via `@hono/node-ws` injected into the existing `serve()`. A Deepgram streaming-client wrapper (`deepgram-live.ts`) over the v5 `listen.v1.connect(...)` socket. The per-turn pipeline is extracted from `voice.ts` into a transport-agnostic `runTurn()` that both the existing SSE route and the new WS route call. A `VOICE_LIVE_USER_IDS` allowlist gates access.

**Tech Stack:** Hono, `@hono/node-ws`, `@deepgram/sdk` v5 (live), Drizzle/Postgres (entitlements), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-live-voice-mode-streaming-stt-design.md`

---

## File Structure

- Create `apps/api/src/providers/deepgram-live.ts` — streaming STT client wrapper (open socket, typed events).
- Create `apps/api/src/providers/deepgram-live.test.ts` — unit tests with an injected mock socket.
- Create `apps/api/src/lib/voice-entitlement.ts` — `VOICE_LIVE_USER_IDS` parse + `canUseLiveVoice()`.
- Create `apps/api/src/lib/voice-entitlement.test.ts`.
- Create `apps/api/src/routes/run-turn.ts` — transport-agnostic turn pipeline extracted from `voice.ts`.
- Create `apps/api/src/routes/run-turn.test.ts`.
- Create `apps/api/src/routes/voice-live.ts` — the `/v1/voice/live` WS route factory.
- Create `apps/api/src/routes/voice-live.test.ts`.
- Modify `apps/api/src/env.ts` — add `VOICE_LIVE_USER_IDS`.
- Modify `apps/api/src/index.ts` — `createNodeWebSocket` + `injectWebSocket(server)`.
- Modify `apps/api/src/app.ts` — register the live route + pass `upgradeWebSocket`.
- Modify `apps/api/src/routes/voice.ts` — delegate its inner turn loop to `runTurn()`.
- Modify rate-card seed (`apps/api/src/db/seed-rate-cards.ts`) — add `deepgram:streaming`.

---

## Task 1: Add the WebSocket layer

**Files:**

- Modify: `apps/api/package.json` (dep)
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Install the adapter**

Run: `cd apps/api && npx expo@latest --version >/dev/null 2>&1; pnpm add @hono/node-ws` (from repo root: `pnpm --filter @language-coach/api add @hono/node-ws`)
Expected: `@hono/node-ws` appears in `apps/api/package.json` dependencies, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Thread `upgradeWebSocket` into the app factory**

In `apps/api/src/app.ts`, accept an optional injected `upgradeWebSocket` so tests can run without a live server, and expose it to route registration:

```ts
import type { UpgradeWebSocket } from "hono/ws";
// in createApp signature overrides:
overrides?: { verifier?: Verifier; upgradeWebSocket?: UpgradeWebSocket },
// after other routes are registered, if upgradeWebSocket provided:
if (overrides?.upgradeWebSocket) {
  app.route(
    "/",
    createVoiceLiveRoute({ ...liveDeps, upgradeWebSocket: overrides.upgradeWebSocket }),
  );
}
```

- [ ] **Step 3: Wire `injectWebSocket` in the server entrypoint**

In `apps/api/src/index.ts`:

```ts
import { createNodeWebSocket } from "@hono/node-ws";
// ...
const appBase = createApp(env);
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
  app: appBase,
});
// rebuild app with ws (or pass upgradeWebSocket into createApp via a small refactor)
const server = serve({ fetch: appBase.fetch, port: env.PORT }, (info) => {
  log.info(`listening on :${info.port}`);
});
injectWebSocket(server);
```

(If `createApp` needs `upgradeWebSocket` at construction, construct `createNodeWebSocket({ app: new Hono() })` first, then pass `upgradeWebSocket` into `createApp`. Lock the exact wiring when implementing — keep `app.fetch` unchanged for all HTTP routes.)

- [ ] **Step 4: Smoke-verify HTTP still serves**

Run: `cd apps/api && npx vitest run` then `node --import tsx -e "import('./src/app.ts').then(()=>console.log('app loads'))"`
Expected: existing suite green; app module loads without throwing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json ../../pnpm-lock.yaml apps/api/src/index.ts apps/api/src/app.ts
git commit -m "feat(api): add @hono/node-ws WebSocket layer"
```

---

## Task 2: Live-voice entitlement allowlist

**Files:**

- Modify: `apps/api/src/env.ts`
- Create: `apps/api/src/lib/voice-entitlement.ts`
- Test: `apps/api/src/lib/voice-entitlement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseLiveVoiceIds, canUseLiveVoice } from "./voice-entitlement";

describe("voice-entitlement", () => {
  it("parses a comma-separated allowlist, trimming blanks", () => {
    expect(parseLiveVoiceIds(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseLiveVoiceIds("")).toEqual([]);
  });
  it("allows only allowlisted user ids", () => {
    const ids = ["user-1", "user-2"];
    expect(canUseLiveVoice("user-1", ids)).toBe(true);
    expect(canUseLiveVoice("user-x", ids)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/lib/voice-entitlement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/api/src/lib/voice-entitlement.ts`:

```ts
export function parseLiveVoiceIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function canUseLiveVoice(userId: string, allowlist: string[]): boolean {
  return allowlist.includes(userId);
}
```

Add to `apps/api/src/env.ts` `EnvSchema`:

```ts
VOICE_LIVE_USER_IDS: z.string().default(""), // comma-separated user IDs allowed to use Live mode
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/lib/voice-entitlement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/voice-entitlement.ts apps/api/src/lib/voice-entitlement.test.ts apps/api/src/env.ts
git commit -m "feat(api): live-voice entitlement allowlist"
```

---

## Task 3: Deepgram streaming client wrapper

**Files:**

- Create: `apps/api/src/providers/deepgram-live.ts`
- Test: `apps/api/src/providers/deepgram-live.test.ts`

Design: `openLiveTranscription(deps, opts)` opens a Deepgram live socket and returns a small handle: `{ sendAudio(bytes), finalize(), close(), on(event, cb) }` where `event ∈ "transcript" | "utteranceEnd" | "open" | "error" | "close"`. The Deepgram socket factory is injected so tests use a fake.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { openLiveTranscription, type LiveSocket } from "./deepgram-live";

function fakeSocket() {
  const handlers: Record<string, ((m: unknown) => void)[]> = {};
  return {
    on: (e: string, cb: (m: unknown) => void) => {
      (handlers[e] ??= []).push(cb);
    },
    sendMedia: vi.fn(),
    sendFinalize: vi.fn(),
    close: vi.fn(),
    emit: (e: string, m?: unknown) => (handlers[e] ?? []).forEach((h) => h(m)),
  };
}

describe("openLiveTranscription", () => {
  it("forwards final transcripts and utterance-end to handlers", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    const live = await openLiveTranscription(
      { connect },
      { languageCode: "es" },
    );
    const transcripts: string[] = [];
    let ended = false;
    live.on("transcript", (t) =>
      transcripts.push((t as { text: string }).text),
    );
    live.on("utteranceEnd", () => (ended = true));

    sock.emit("message", {
      type: "Results",
      is_final: true,
      channel: { alternatives: [{ transcript: "hola mundo" }] },
    });
    sock.emit("message", { type: "UtteranceEnd" });

    expect(transcripts).toEqual(["hola mundo"]);
    expect(ended).toBe(true);
  });

  it("sends audio bytes via sendMedia", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    const live = await openLiveTranscription(
      { connect },
      { languageCode: "en" },
    );
    const bytes = new Uint8Array([1, 2, 3]);
    live.sendAudio(bytes);
    expect(sock.sendMedia).toHaveBeenCalledWith(bytes);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/providers/deepgram-live.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/api/src/providers/deepgram-live.ts`:

```ts
import { deepgramModelForLanguage } from "./deepgram";

// Minimal shape of the v5 listen socket we depend on (injectable for tests).
export interface RawLiveSocket {
  on(
    event: "open" | "message" | "close" | "error",
    cb: (m: unknown) => void,
  ): void;
  sendMedia(bytes: ArrayBuffer | ArrayBufferView): void;
  sendFinalize(msg?: unknown): void;
  close(): void;
}
export type ConnectFn = (
  args: Record<string, unknown>,
) => Promise<RawLiveSocket>;

export type LiveEvent =
  | "transcript"
  | "utteranceEnd"
  | "open"
  | "error"
  | "close";
export interface LiveSocket {
  on(event: LiveEvent, cb: (payload: unknown) => void): void;
  sendAudio(bytes: ArrayBuffer | ArrayBufferView): void;
  finalize(): void;
  close(): void;
}

export interface LiveOpts {
  languageCode: string;
  sampleRate?: number; // default 16000
}

export async function openLiveTranscription(
  deps: { connect: ConnectFn },
  opts: LiveOpts,
): Promise<LiveSocket> {
  const handlers: Partial<Record<LiveEvent, ((p: unknown) => void)[]>> = {};
  const fire = (e: LiveEvent, p?: unknown) =>
    (handlers[e] ?? []).forEach((h) => h(p));

  const sock = await deps.connect({
    model: deepgramModelForLanguage(opts.languageCode),
    language: opts.languageCode,
    encoding: "linear16",
    sample_rate: opts.sampleRate ?? 16000,
    interim_results: true,
    smart_format: true,
    vad_events: true,
    utterance_end_ms: 1000,
  });

  sock.on("open", () => fire("open"));
  sock.on("close", () => fire("close"));
  sock.on("error", (e) => fire("error", e));
  sock.on("message", (raw) => {
    const m = raw as {
      type?: string;
      is_final?: boolean;
      channel?: { alternatives?: { transcript?: string }[] };
    };
    if (m.type === "UtteranceEnd") {
      fire("utteranceEnd");
      return;
    }
    if (m.type === "Results" && m.is_final) {
      const text = m.channel?.alternatives?.[0]?.transcript ?? "";
      if (text.trim()) fire("transcript", { text });
    }
  });

  return {
    on: (e, cb) => {
      (handlers[e] ??= []).push(cb);
    },
    sendAudio: (bytes) => sock.sendMedia(bytes),
    finalize: () => sock.sendFinalize(),
    close: () => sock.close(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/providers/deepgram-live.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/deepgram-live.ts apps/api/src/providers/deepgram-live.test.ts
git commit -m "feat(api): Deepgram streaming STT client wrapper"
```

---

## Task 4: Extract transport-agnostic `runTurn()`

**Files:**

- Read first: `apps/api/src/routes/voice.ts` (the SSE turn loop — the LLM→sentence-buffer→TTS emit logic)
- Create: `apps/api/src/routes/run-turn.ts`
- Test: `apps/api/src/routes/run-turn.test.ts`
- Modify: `apps/api/src/routes/voice.ts` (call `runTurn`, keep SSE behaviour identical)

Goal: one function that takes the final transcript + conversation context + deps and emits reply chunks via a callback, so SSE and WS share it. Signature:

```ts
export type ReplyChunk = {
  text: string;
  audioBase64: string;
  contentType: string;
};
export type RunTurnDeps = {
  streamChatCompletion: (input: StreamInput) => AsyncGenerator<string>;
  synthesizeSpeech: SynthesizeSpeechFn;
};
export async function runTurn(
  deps: RunTurnDeps,
  input: {
    messages: ChatMessage[];
    languageCode: string;
    ttsConfig?: TtsConfig;
    signal?: AbortSignal;
  },
  onChunk: (chunk: ReplyChunk) => Promise<void> | void,
): Promise<{ fullText: string }>;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { runTurn } from "./run-turn";

async function* fakeLLM() {
  yield "Hello. ";
  yield "How are you?";
}

describe("runTurn", () => {
  it("buffers sentences and emits a chunk with audio per sentence", async () => {
    const synthesizeSpeech = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from([9]),
      contentType: "audio/mpeg",
    });
    const chunks: { text: string; audioBase64: string }[] = [];
    const out = await runTurn(
      { streamChatCompletion: () => fakeLLM(), synthesizeSpeech },
      { messages: [{ role: "user", content: "hi" }], languageCode: "en" },
      (c) => {
        chunks.push({ text: c.text, audioBase64: c.audioBase64 });
      },
    );
    expect(out.fullText).toBe("Hello. How are you?");
    expect(chunks.map((c) => c.text)).toEqual(["Hello.", "How are you?"]);
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(chunks[0].audioBase64).toBe(Buffer.from([9]).toString("base64"));
  });

  it("stops emitting when the abort signal fires", async () => {
    const ac = new AbortController();
    const synthesizeSpeech = vi.fn().mockImplementation(async () => {
      ac.abort();
      return { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };
    });
    const chunks: string[] = [];
    await runTurn(
      { streamChatCompletion: () => fakeLLM(), synthesizeSpeech },
      { messages: [], languageCode: "en", signal: ac.signal },
      (c) => {
        chunks.push(c.text);
      },
    );
    expect(chunks.length).toBe(1); // aborted before the second sentence
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/routes/run-turn.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `run-turn.ts`** by lifting the sentence-buffer + per-chunk TTS logic out of `voice.ts` (the code around the `reply-chunk` emit). Use the existing sentence-splitting helper from `voice.ts`; export it from a shared spot if needed. Honor `signal?.aborted` before each synth + emit. Return `{ fullText }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/routes/run-turn.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Refactor `voice.ts` to call `runTurn`** for its turn loop, mapping each `ReplyChunk` onto the existing SSE `reply-chunk` event (inline base64 path for capability-negotiated clients; signed-URL path unchanged). Do not change the SSE wire format.

- [ ] **Step 6: Run the full suite — SSE behaviour must be unchanged**

Run: `cd apps/api && npx vitest run`
Expected: PASS, same count as before plus the 2 new run-turn tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/run-turn.ts apps/api/src/routes/run-turn.test.ts apps/api/src/routes/voice.ts
git commit -m "refactor(api): extract transport-agnostic runTurn() shared by SSE + WS"
```

---

## Task 5: The `/v1/voice/live` WebSocket route

**Files:**

- Create: `apps/api/src/routes/voice-live.ts`
- Test: `apps/api/src/routes/voice-live.test.ts`
- Modify: `apps/api/src/app.ts` (register)

Behaviour: on connect, read the JWT (query param `?token=` — RN can't set WS headers; wss is TLS so it's encrypted in transit; never log the URL/query), verify via the injected `Verifier`, look up entitlement + `canUseLiveVoice`, check daily quota. Open a Deepgram live socket. On inbound binary frame → `sendAudio`. On `utteranceEnd` → load history + `runTurn`, sending each `ReplyChunk` to the client as a JSON ws message `{type:"reply-chunk", ...}`. On inbound `{type:"cancel"}` text frame → abort the in-flight turn (AbortController). On close → close Deepgram. Reject (close code 4401/4403) when auth/entitlement/quota fail.

The route factory takes injected deps (verifier, entitlement loader, openLive, runTurn deps, upgradeWebSocket) so tests drive it with fakes and assert the control logic without a real socket server.

- [ ] **Step 1: Write the failing test** (control-logic level: simulate the ws events object that `upgradeWebSocket` hands the handler, feeding messages and asserting outbound `ws.send` + abort-on-cancel). Cover: rejects non-allowlisted user; relays audio to Deepgram; utterance-end runs a turn and sends reply-chunks; `cancel` aborts the in-flight turn.

- [ ] **Step 2: Run test to verify it fails.** Run: `cd apps/api && npx vitest run src/routes/voice-live.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `voice-live.ts`** per the behaviour above, reusing `openLiveTranscription`, `runTurn`, `canUseLiveVoice`, the quota helper, and the `Verifier`.

- [ ] **Step 4: Run test to verify it passes.** Run: `cd apps/api && npx vitest run src/routes/voice-live.test.ts` → PASS.

- [ ] **Step 5: Register the route** in `app.ts` behind the injected `upgradeWebSocket` (see Task 1, Step 2).

- [ ] **Step 6: Full suite green.** Run: `cd apps/api && npx vitest run` → PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/api/src/routes/voice-live.ts apps/api/src/routes/voice-live.test.ts apps/api/src/app.ts
git commit -m "feat(api): /v1/voice/live WebSocket route (streaming STT relay + barge-in cancel)"
```

---

## Task 6: `deepgram:streaming` rate card + usage

**Files:**

- Modify: `apps/api/src/db/seed-rate-cards.ts`
- Modify: the live route to record usage on close (seconds streamed)

- [ ] **Step 1: Add the rate card** entry for `provider: "deepgram", operation: "stt:streaming"` mirroring the existing batch card (per-minute price; honor the nova-2 carve-out for Chinese already encoded in `deepgramModelForLanguage`).

- [ ] **Step 2: Record usage** when the live socket closes: total streamed seconds → `onUsage({ provider: "deepgram", operation: "stt:streaming", seconds })`. Add a test asserting usage is recorded once on close.

- [ ] **Step 3: Full suite green + commit.**

```bash
git add apps/api/src/db/seed-rate-cards.ts apps/api/src/routes/voice-live.ts apps/api/src/routes/voice-live.test.ts
git commit -m "feat(api): deepgram streaming rate card + usage recording"
```

---

## Done-criteria for Plan A

- `npx vitest run` green in `apps/api` (all new tests + unchanged SSE tests).
- `pnpm --filter @language-coach/api typecheck` and `lint` clean.
- A manual smoke script (`scripts/smoke-voice-live.ts`, optional) can open the WS locally and stream a wav fixture to confirm transcripts flow — not required for merge.
- PR opened; `api-deploy` green. No mobile change in this plan.
