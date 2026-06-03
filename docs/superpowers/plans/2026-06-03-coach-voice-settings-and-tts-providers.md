# Coach's Voice settings + Gemini & Inworld TTS providers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the dev-only Voice Lab into an everyone-facing "Coach's voice" setting under a "Coach settings" group, and add Google Gemini 3.1 Flash TTS + Inworld TTS 1.5 Max as selectable providers.

**Architecture:** Backend keeps its provider-agnostic TTS router (`makeSynthesizeSpeech`) — we add two `fetch`-based provider modules (Gemini → PCM wrapped to WAV; Inworld → MP3) behind optional env keys, refactor the router to a deps object, and widen the shared `TtsProvider` union + voice catalogs. Mobile drops the `__DEV__` gate and override toggle, regroups Profile into "Coach settings" (Coach's Memory + Coach's voice), and renders all four providers with friendly descriptors.

**Tech Stack:** TypeScript, Hono (API), Vitest (API tests), Zod, Expo/React Native + zustand (mobile), pnpm workspaces + Turbo.

**Spec:** `docs/superpowers/specs/2026-06-03-coach-voice-settings-and-tts-providers-design.md`

**Conventions for every commit:** work on a feature branch, not `main`. Before any push run `pnpm format && pnpm lint && pnpm typecheck && pnpm test` from `app/` and keep them green (per the always-keep-CI-green rule). All commands below assume CWD `C:/Users/bruno.moise/My Language Coach - rebuild/app` unless stated.

**Branch setup (do once before Task 1):**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git checkout -b feat/coach-voice-gemini-inworld
```

---

## Phase 1 — Shared types

### Task 1: Widen the shared TTS provider union + add voice catalogs

**Files:**

- Modify: `packages/shared/src/tts-config.ts`

(`packages/shared/src/index.ts:10` already does `export * from "./tts-config"`, so new exports surface automatically. The shared package has no Vitest setup; verify with typecheck.)

- [ ] **Step 1: Add the two providers to the union**

In `packages/shared/src/tts-config.ts`, change line 1:

```ts
export type TtsProvider = "openai" | "elevenlabs" | "gemini" | "inworld";
```

- [ ] **Step 2: Add the two voice catalogs**

Append to `packages/shared/src/tts-config.ts` (after `TTS_SPEED_OPTIONS`):

```ts
// Gemini prebuilt voices are language-agnostic — the model speaks whatever
// language is requested. id === name (Gemini takes the voice name directly).
export const GEMINI_TTS_VOICES = [
  { id: "Kore", name: "Kore" },
  { id: "Puck", name: "Puck" },
  { id: "Charon", name: "Charon" },
  { id: "Aoede", name: "Aoede" },
  { id: "Leda", name: "Leda" },
  { id: "Orus", name: "Orus" },
] as const;

// NOTE: verify these voice IDs against Inworld's voice-list endpoint during
// Task 5 and adjust here if the API rejects any. Names double as IDs.
export const INWORLD_TTS_VOICES = [
  { id: "Ashley", name: "Ashley" },
  { id: "Olivia", name: "Olivia" },
  { id: "Mark", name: "Mark" },
  { id: "Hades", name: "Hades" },
  { id: "Sarah", name: "Sarah" },
] as const;
```

- [ ] **Step 3: Typecheck the shared package**

Run: `pnpm --filter @language-coach/shared typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/tts-config.ts
git commit -m "feat(shared): add gemini + inworld TTS providers and voice catalogs"
```

---

## Phase 2 — Backend providers

### Task 2: Extend ProviderError codes + UsageReport providers

**Files:**

- Modify: `apps/api/src/providers/deepgram.ts:19-26`
- Modify: `apps/api/src/providers/usage.ts:8`

- [ ] **Step 1: Add the not-configured error code**

In `apps/api/src/providers/deepgram.ts`, extend the `code` union in the `ProviderError` constructor to include `"TTS_PROVIDER_NOT_CONFIGURED"`:

```ts
    public code:
      | "STT_PROVIDER_FAILURE"
      | "LLM_PROVIDER_FAILURE"
      | "TTS_PROVIDER_FAILURE"
      | "TTS_PROVIDER_NOT_CONFIGURED"
      | "AUDIO_SILENT"
      | "AUDIO_TOO_SHORT"
      | "AUDIO_TOO_LONG"
      | "QUOTA_EXCEEDED",
```

- [ ] **Step 2: Add gemini + inworld to UsageReport.provider**

In `apps/api/src/providers/usage.ts`, change line 8:

```ts
provider: "openai" | "deepgram" | "elevenlabs" | "gemini" | "inworld";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @language-coach/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/providers/deepgram.ts apps/api/src/providers/usage.ts
git commit -m "feat(api): add TTS_PROVIDER_NOT_CONFIGURED code + gemini/inworld usage providers"
```

---

### Task 3: PCM→WAV helper

**Files:**

- Create: `apps/api/src/providers/audio.ts`
- Test: `apps/api/src/providers/audio.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/providers/audio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pcmToWav } from "./audio";

describe("pcmToWav", () => {
  it("prepends a 44-byte RIFF/WAVE header", () => {
    const pcm = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
    const wav = pcmToWav(pcm);
    expect(wav.byteLength).toBe(44 + pcm.byteLength);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    // PCM payload is preserved after the header.
    expect(wav.subarray(44).equals(pcm)).toBe(true);
  });

  it("writes sample rate and byte rate for 24kHz mono 16-bit", () => {
    const wav = pcmToWav(Buffer.from([0, 0, 0, 0]));
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt16LE(22)).toBe(1); // channels
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.readUInt32LE(28)).toBe(24000 * 1 * 2); // byte rate
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/audio.test.ts`
Expected: FAIL — cannot find module `./audio` / `pcmToWav is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/providers/audio.ts`:

```ts
// Wrap raw little-endian PCM samples in a canonical 44-byte WAV header so the
// audio is directly playable (expo-av plays audio/wav on iOS + Android).
// Gemini TTS returns signed 16-bit LE PCM (default 24kHz mono).
export function pcmToWav(
  pcm: Buffer,
  opts: { sampleRate?: number; channels?: number; bitsPerSample?: number } = {},
): Buffer {
  const sampleRate = opts.sampleRate ?? 24000;
  const channels = opts.channels ?? 1;
  const bitsPerSample = opts.bitsPerSample ?? 16;

  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/audio.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/audio.ts apps/api/src/providers/audio.test.ts
git commit -m "feat(api): add pcmToWav helper for Gemini PCM audio"
```

---

### Task 4: Gemini TTS provider

**Files:**

- Create: `apps/api/src/providers/gemini.ts`
- Test: `apps/api/src/providers/gemini.test.ts`

Reuses `SynthesizeInput` / `SynthesizeResult` from `./elevenlabs`, `ProviderError` from `./deepgram`, `openAiStylePhrase` + `pacePhrase` from `./tts-config`, and `pcmToWav` from `./audio`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/providers/gemini.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { synthesizeSpeechGemini } from "./gemini";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("synthesizeSpeechGemini", () => {
  const pcmBase64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: { mimeType: "audio/L16;rate=24000", data: pcmBase64 },
            },
          ],
        },
      },
    ],
  };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when key missing", async () => {
    await expect(
      synthesizeSpeechGemini(undefined, { text: "hi", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns WAV audio on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechGemini("key", {
      text: "Hola",
      voiceId: "Kore",
      languageCode: "es",
    });
    expect(result.contentType).toBe("audio/wav");
    // 44-byte header + 4 PCM bytes
    expect(result.audioBuffer.byteLength).toBe(48);
    expect(result.audioBuffer.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("sends the voice name in speechConfig", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechGemini("key", { text: "Hola", voiceId: "Puck" });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(
      body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
        .voiceName,
    ).toBe("Puck");
    expect(body.generationConfig.responseModalities).toContain("AUDIO");
  });

  it("calls onUsage with characters", async () => {
    mockFetchOnce(okBody);
    const onUsage = vi.fn();
    await synthesizeSpeechGemini("key", {
      text: "Hola",
      voiceId: "Kore",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "gemini", characters: 4 }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE on non-ok response", async () => {
    mockFetchOnce({ error: "boom" }, false, 500);
    await expect(
      synthesizeSpeechGemini("key", { text: "x", voiceId: "Kore" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/gemini.test.ts`
Expected: FAIL — cannot find module `./gemini`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/providers/gemini.ts`:

```ts
import { LANGUAGES } from "@language-coach/shared";
import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";
import { openAiStylePhrase, pacePhrase } from "./tts-config";
import { pcmToWav } from "./audio";

// Model id is isolated here — Gemini TTS model naming may need a tweak once
// verified against the live API (see spec).
const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts";

function buildPrompt(input: SynthesizeInput): string {
  const lang = input.languageCode
    ? LANGUAGES.find((l) => l.code === input.languageCode)
    : undefined;
  const style = openAiStylePhrase(input.style ?? "warm");
  const pace = pacePhrase(input.speed ?? 1.0);
  const langClause = lang
    ? `Speak in ${lang.englishName} with a natural, native accent. `
    : "";
  // Gemini TTS has no native speed param; pace + style are conveyed in prose.
  return `${langClause}Use ${style} and ${pace}.\n\n${input.text}`;
}

function parseSampleRate(mimeType: string | undefined): number {
  // e.g. "audio/L16;rate=24000"
  const m = mimeType?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : 24000;
}

export async function synthesizeSpeechGemini(
  apiKey: string | undefined,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  if (!apiKey) {
    throw new ProviderError(
      "TTS_PROVIDER_NOT_CONFIGURED",
      503,
      "Gemini API key not configured",
    );
  }

  let json: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
      };
    }>;
  };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: input.voiceId },
              },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${detail}`);
    }
    json = await res.json();
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Gemini error: ${(err as Error).message}`,
    );
  }

  const part = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      "Gemini error: no audio in response",
    );
  }

  const pcm = Buffer.from(part.data, "base64");
  const audioBuffer = pcmToWav(pcm, {
    sampleRate: parseSampleRate(part.mimeType),
  });

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "gemini",
        operation: `tts:${GEMINI_TTS_MODEL}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return { audioBuffer, contentType: "audio/wav" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/gemini.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/gemini.ts apps/api/src/providers/gemini.test.ts
git commit -m "feat(api): add Gemini 3.1 Flash TTS provider"
```

---

### Task 5: Inworld TTS provider

**Files:**

- Create: `apps/api/src/providers/inworld.ts`
- Test: `apps/api/src/providers/inworld.test.ts`

> **Verify at implementation time:** the exact Inworld endpoint, auth scheme (Basic vs Bearer), request field names (`voiceId`/`modelId`/`audioConfig`), response field (`audioContent`), and the curated voice IDs in `INWORLD_TTS_VOICES`. The code below reflects the documented shape as of the spec; adjust the constants/field names if the live API differs, and update Task 1's `INWORLD_TTS_VOICES` to match the voice-list endpoint.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/providers/inworld.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { synthesizeSpeechInworld } from "./inworld";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("synthesizeSpeechInworld", () => {
  const mp3Base64 = Buffer.from([1, 2, 3, 4]).toString("base64");
  const okBody = { audioContent: mp3Base64 };

  it("throws TTS_PROVIDER_NOT_CONFIGURED when key missing", async () => {
    await expect(
      synthesizeSpeechInworld(undefined, { text: "hi", voiceId: "Ashley" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_NOT_CONFIGURED" });
  });

  it("returns MP3 audio on success", async () => {
    mockFetchOnce(okBody);
    const result = await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Ashley",
      speed: 1.1,
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.audioBuffer.byteLength).toBe(4);
  });

  it("sends voiceId, model and speakingRate", async () => {
    mockFetchOnce(okBody);
    await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Olivia",
      speed: 0.9,
    });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(call[1].body as string);
    expect(body.voiceId).toBe("Olivia");
    expect(body.modelId).toBe("inworld-tts-1.5");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(body.audioConfig.speakingRate).toBeCloseTo(0.9);
    expect(call[1].headers.authorization).toMatch(/^Basic /);
  });

  it("calls onUsage with characters", async () => {
    mockFetchOnce(okBody);
    const onUsage = vi.fn();
    await synthesizeSpeechInworld("key", {
      text: "Hola",
      voiceId: "Ashley",
      onUsage,
    });
    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "inworld", characters: 4 }),
    );
  });

  it("throws TTS_PROVIDER_FAILURE on non-ok response", async () => {
    mockFetchOnce({ error: "boom" }, false, 401);
    await expect(
      synthesizeSpeechInworld("key", { text: "x", voiceId: "Ashley" }),
    ).rejects.toMatchObject({ code: "TTS_PROVIDER_FAILURE" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/inworld.test.ts`
Expected: FAIL — cannot find module `./inworld`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/providers/inworld.ts`:

```ts
import type { SynthesizeInput, SynthesizeResult } from "./elevenlabs";
import { ProviderError } from "./deepgram";

// Isolated so a tier/model change is one edit. "inworld-tts-1.5" == the Max tier.
const INWORLD_TTS_MODEL = "inworld-tts-1.5";
const INWORLD_TTS_URL = "https://api.inworld.ai/tts/v1/voice";

export async function synthesizeSpeechInworld(
  apiKey: string | undefined,
  input: SynthesizeInput,
): Promise<SynthesizeResult> {
  if (!apiKey) {
    throw new ProviderError(
      "TTS_PROVIDER_NOT_CONFIGURED",
      503,
      "Inworld API key not configured",
    );
  }

  // Inworld API keys are issued as a base64 string used directly as Basic auth.
  const speakingRate = Math.min(1.2, Math.max(0.7, input.speed ?? 1.0));

  let json: { audioContent?: string };
  try {
    const res = await fetch(INWORLD_TTS_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        voiceId: input.voiceId,
        modelId: INWORLD_TTS_MODEL,
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${detail}`);
    }
    json = await res.json();
  } catch (err) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      `Inworld error: ${(err as Error).message}`,
    );
  }

  if (!json.audioContent) {
    throw new ProviderError(
      "TTS_PROVIDER_FAILURE",
      503,
      "Inworld error: no audio in response",
    );
  }

  if (input.onUsage) {
    void Promise.resolve(
      input.onUsage({
        provider: "inworld",
        operation: `tts:${INWORLD_TTS_MODEL}`,
        characters: input.text.length,
      }),
    ).catch(() => {});
  }

  return {
    audioBuffer: Buffer.from(json.audioContent, "base64"),
    contentType: "audio/mpeg",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/inworld.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/inworld.ts apps/api/src/providers/inworld.test.ts
git commit -m "feat(api): add Inworld TTS 1.5 Max provider"
```

---

### Task 6: Widen backend config zod enum

**Files:**

- Modify: `apps/api/src/providers/tts-config.ts:10`
- Test: `apps/api/src/providers/tts-config.test.ts`

- [ ] **Step 1: Add a failing test for the new providers**

Append inside the existing top-level `describe` in `apps/api/src/providers/tts-config.test.ts` (mirror the file's existing `parseTtsConfig` test style):

```ts
it("accepts gemini and inworld providers", () => {
  const gemini = parseTtsConfig({
    provider: "gemini",
    voiceId: "Kore",
    speed: 1.0,
    style: "warm",
  });
  expect(gemini.provider).toBe("gemini");

  const inworld = parseTtsConfig({
    provider: "inworld",
    voiceId: "Ashley",
    speed: 1.0,
    style: "warm",
  });
  expect(inworld.provider).toBe("inworld");
});
```

Ensure `parseTtsConfig` is imported at the top of the test file (it is already used there; if not, add `import { parseTtsConfig } from "./tts-config";`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/tts-config.test.ts`
Expected: FAIL — gemini/inworld fall back to default (`provider` is `"openai"`), so assertions fail.

- [ ] **Step 3: Widen the enum**

In `apps/api/src/providers/tts-config.ts`, change line 10:

```ts
  provider: z.enum(["openai", "elevenlabs", "gemini", "inworld"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/tts-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/tts-config.ts apps/api/src/providers/tts-config.test.ts
git commit -m "feat(api): accept gemini + inworld in TTS config schema"
```

---

### Task 7: Refactor the TTS router to a deps object + dispatch all four providers

**Files:**

- Modify: `apps/api/src/providers/tts-router.ts`
- Test: `apps/api/src/providers/tts-router.test.ts`

- [ ] **Step 1: Rewrite the router test for the deps-object API**

Replace the entire contents of `apps/api/src/providers/tts-router.test.ts` with:

```ts
import { describe, it, expect, vi } from "vitest";
import { makeSynthesizeSpeech } from "./tts-router";

describe("makeSynthesizeSpeech", () => {
  const result = { audioBuffer: Buffer.from([1]), contentType: "audio/mpeg" };

  function deps(overrides: Record<string, unknown>) {
    return {
      openai: {} as never,
      eleven: {} as never,
      geminiKey: "gk",
      inworldKey: "ik",
      synth: overrides,
    };
  }

  it("default config routes to OpenAI with nova", async () => {
    const openai = vi.fn().mockResolvedValue(result);
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ openai, eleven }));
    await synth({ text: "hi", languageCode: "es" });
    expect(eleven).not.toHaveBeenCalled();
    expect(openai).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ voiceId: "nova", languageCode: "es" }),
    );
  });

  it("elevenlabs config routes to ElevenLabs", async () => {
    const openai = vi.fn().mockResolvedValue(result);
    const eleven = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ openai, eleven }));
    await synth({
      text: "ciao",
      languageCode: "it",
      config: {
        provider: "elevenlabs",
        voiceId: "v1",
        speed: 1.1,
        style: "calm",
      },
    });
    expect(openai).not.toHaveBeenCalled();
    expect(eleven).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        voiceId: "v1",
        languageCode: "it",
        speed: 1.1,
      }),
    );
  });

  it("gemini config routes to Gemini with the key", async () => {
    const gemini = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ gemini }));
    await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "gemini",
        voiceId: "Kore",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(gemini).toHaveBeenCalledWith(
      "gk",
      expect.objectContaining({ voiceId: "Kore", languageCode: "es" }),
    );
  });

  it("inworld config routes to Inworld with the key", async () => {
    const inworld = vi.fn().mockResolvedValue(result);
    const synth = makeSynthesizeSpeech(deps({ inworld }));
    await synth({
      text: "hola",
      languageCode: "es",
      config: {
        provider: "inworld",
        voiceId: "Ashley",
        speed: 1.0,
        style: "warm",
      },
    });
    expect(inworld).toHaveBeenCalledWith(
      "ik",
      expect.objectContaining({ voiceId: "Ashley", languageCode: "es" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/tts-router.test.ts`
Expected: FAIL — `makeSynthesizeSpeech` still expects positional args; type/runtime errors.

- [ ] **Step 3: Rewrite the router**

Replace the entire contents of `apps/api/src/providers/tts-router.ts` with:

```ts
import type OpenAI from "openai";
import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";
import {
  synthesizeSpeechOpenAI,
  type TtsResult,
  type TtsInput,
} from "./openai";
import {
  synthesizeSpeech as synthesizeSpeechElevenLabs,
  type SynthesizeInput,
} from "./elevenlabs";
import { synthesizeSpeechGemini } from "./gemini";
import { synthesizeSpeechInworld } from "./inworld";
import type { OnUsage } from "./usage";

export type RoutedTtsInput = {
  text: string;
  languageCode?: string;
  config?: TtsConfig;
  onUsage?: OnUsage;
};

export type TtsDeps = {
  openai: OpenAI;
  eleven: ElevenLabsClient;
  geminiKey?: string;
  inworldKey?: string;
  // Injected so tests can stub providers; production uses the real fns.
  synth?: {
    openai?: (c: OpenAI, i: TtsInput) => Promise<TtsResult>;
    eleven?: (c: ElevenLabsClient, i: SynthesizeInput) => Promise<TtsResult>;
    gemini?: (
      key: string | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
    inworld?: (
      key: string | undefined,
      i: SynthesizeInput,
    ) => Promise<TtsResult>;
  };
};

export function makeSynthesizeSpeech(deps: TtsDeps) {
  const openAiSynth = deps.synth?.openai ?? synthesizeSpeechOpenAI;
  const elevenSynth = deps.synth?.eleven ?? synthesizeSpeechElevenLabs;
  const geminiSynth = deps.synth?.gemini ?? synthesizeSpeechGemini;
  const inworldSynth = deps.synth?.inworld ?? synthesizeSpeechInworld;

  return async (input: RoutedTtsInput): Promise<TtsResult> => {
    const config = input.config ?? DEFAULT_TTS_CONFIG;
    const shared = {
      text: input.text,
      voiceId: config.voiceId,
      languageCode: input.languageCode,
      speed: config.speed,
      style: config.style,
      onUsage: input.onUsage,
    };
    switch (config.provider) {
      case "elevenlabs":
        return elevenSynth(deps.eleven, shared);
      case "gemini":
        return geminiSynth(deps.geminiKey, shared);
      case "inworld":
        return inworldSynth(deps.inworldKey, shared);
      default:
        return openAiSynth(deps.openai, shared);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @language-coach/api exec vitest run src/providers/tts-router.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/providers/tts-router.ts apps/api/src/providers/tts-router.test.ts
git commit -m "refactor(api): TTS router takes deps object, dispatches 4 providers"
```

---

### Task 8: Wire env keys + update the app.ts call site

**Files:**

- Modify: `apps/api/src/env.ts:13-15` (add two optional vars)
- Modify: `apps/api/src/app.ts:205`

- [ ] **Step 1: Add the optional env vars**

In `apps/api/src/env.ts`, inside `EnvSchema` (after the `ELEVENLABS_API_KEY` line), add:

```ts
  GEMINI_API_KEY: z.string().optional(),
  INWORLD_API_KEY: z.string().optional(),
```

- [ ] **Step 2: Update the call site**

In `apps/api/src/app.ts`, change line 205 from:

```ts
const synthesizeSpeech = makeSynthesizeSpeech(openai, eleven);
```

to:

```ts
const synthesizeSpeech = makeSynthesizeSpeech({
  openai,
  eleven,
  geminiKey: env.GEMINI_API_KEY,
  inworldKey: env.INWORLD_API_KEY,
});
```

- [ ] **Step 3: Typecheck + run the full API test suite**

Run: `pnpm --filter @language-coach/api typecheck && pnpm --filter @language-coach/api test`
Expected: typecheck clean; all provider tests (including new audio/gemini/inworld/router) PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/env.ts apps/api/src/app.ts
git commit -m "feat(api): wire optional GEMINI_API_KEY + INWORLD_API_KEY into TTS router"
```

---

## Phase 3 — Mobile

### Task 9: Voice metadata (labels, taglines, descriptors)

**Files:**

- Create: `apps/mobile/src/features/voice-lab/voice-meta.ts`

(Mobile has no Vitest unit harness for this; verify via typecheck in Task 13's final check. This is pure data.)

- [ ] **Step 1: Create the metadata module**

Create `apps/mobile/src/features/voice-lab/voice-meta.ts`:

```ts
import type { TtsProvider } from "@language-coach/shared";

export const PROVIDER_LABELS: Record<TtsProvider, string> = {
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  gemini: "Gemini",
  inworld: "Inworld",
};

// User-facing taglines — no business metrics.
export const PROVIDER_TAGLINES: Record<TtsProvider, string> = {
  openai: "Natural & expressive",
  elevenlabs: "Ultra-realistic",
  gemini: "Crisp & lifelike",
  inworld: "Warm & conversational",
};

// Keyed by voiceId. Missing entries simply render no caption.
export const VOICE_DESCRIPTORS: Record<string, string> = {
  // OpenAI
  nova: "Bright & friendly",
  shimmer: "Soft & warm",
  sage: "Calm & wise",
  coral: "Lively & cheerful",
  alloy: "Neutral & clear",
  echo: "Smooth & mellow",
  ash: "Steady & grounded",
  ballad: "Gentle & lyrical",
  verse: "Versatile & dynamic",
  // ElevenLabs (keyed by voice id)
  EXAVITQu4vr4xnSDxMaL: "Warm & natural", // Sarah
  XB0fDUnXU5powFXDhCwa: "Soft & soothing", // Charlotte
  "21m00Tcm4TlvDq8ikWAM": "Clear & professional", // Rachel
  JBFqnCBsd6RMkjVDRZzb: "Deep & steady", // George
  pFZP5JQG7iQjIQuC4Bku: "Bright & youthful", // Lily
  // Gemini
  Kore: "Firm & confident",
  Puck: "Upbeat & playful",
  Charon: "Informative & even",
  Aoede: "Breezy & light",
  Leda: "Youthful & bright",
  Orus: "Low & grounded",
  // Inworld
  Ashley: "Warm & friendly",
  Olivia: "Soft & clear",
  Mark: "Steady & calm",
  Hades: "Deep & dramatic",
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/voice-lab/voice-meta.ts
git commit -m "feat(mobile): add voice metadata (labels, taglines, descriptors)"
```

---

### Task 10: Simplify the voice store (drop the override toggle)

**Files:**

- Modify: `apps/mobile/src/features/voice-lab/voice-lab-store.ts`

- [ ] **Step 1: Remove override state**

Replace the entire contents of `apps/mobile/src/features/voice-lab/voice-lab-store.ts` with:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";

type VoiceState = {
  // The picked voice always applies to live conversations.
  config: TtsConfig;
  setConfig: (patch: Partial<TtsConfig>) => void;
  reset: () => void;
};

export const useVoiceLab = create<VoiceState>()(
  persist(
    (set) => ({
      config: DEFAULT_TTS_CONFIG,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ config: DEFAULT_TTS_CONFIG }),
    }),
    {
      // Keep the v1 key: the now-absent `overrideEnabled` field in any persisted
      // blob is simply ignored by zustand on rehydrate.
      name: "voice-lab.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/voice-lab/voice-lab-store.ts
git commit -m "refactor(mobile): voice store always applies config (drop override)"
```

---

### Task 11: Update the live-conversation consumer

**Files:**

- Modify: `apps/mobile/src/features/practice/use-conversation.ts:268-269`

- [ ] **Step 1: Always send the config**

In `apps/mobile/src/features/practice/use-conversation.ts`, change lines 268-269 from:

```ts
const vl = useVoiceLab.getState();
const voiceOverride = vl.overrideEnabled ? vl.config : undefined;
```

to:

```ts
const vl = useVoiceLab.getState();
const voiceOverride = vl.config;
```

(If `vl` is referenced nowhere else after this, the variable stays valid as written. Do not remove the `useVoiceLab` import.)

- [ ] **Step 2: Typecheck the mobile app**

Run: `pnpm --filter @language-coach/mobile typecheck`
Expected: PASS — no reference to the removed `overrideEnabled` remains. (If it errors here or in Task 12, that's the screen still using the old field — fixed in Task 12; you may run this check again after Task 12.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/practice/use-conversation.ts
git commit -m "feat(mobile): coach voice always applies to live conversation"
```

---

### Task 12: Rebuild the Coach's voice screen

**Files:**

- Modify: `apps/mobile/app/(tabs)/profile/voice-lab.tsx` (full rewrite)

- [ ] **Step 1: Replace the screen**

Replace the entire contents of `apps/mobile/app/(tabs)/profile/voice-lab.tsx` with:

```tsx
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
// expo-file-system v19's default export is the new File/Paths API; the
// string-path helpers we need (write base64 → temp file) live under /legacy.
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import {
  LANGUAGES,
  TTS_STYLES,
  OPENAI_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  GEMINI_TTS_VOICES,
  INWORLD_TTS_VOICES,
  TTS_SPEED_OPTIONS,
  type TtsProvider,
} from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { previewVoice } from "@/src/lib/api-client";
import { playOnce } from "@/src/features/practice/audio-controller";
import { useVoiceLab } from "@/src/features/voice-lab/voice-lab-store";
import {
  PROVIDER_LABELS,
  PROVIDER_TAGLINES,
  VOICE_DESCRIPTORS,
} from "@/src/features/voice-lab/voice-meta";

const PROVIDERS: TtsProvider[] = ["openai", "elevenlabs", "gemini", "inworld"];

function voicesFor(provider: TtsProvider): { id: string; name: string }[] {
  switch (provider) {
    case "elevenlabs":
      return ELEVENLABS_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    case "gemini":
      return GEMINI_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    case "inworld":
      return INWORLD_TTS_VOICES.map((v) => ({ id: v.id, name: v.name }));
    default:
      return OPENAI_TTS_VOICES.map((v) => ({ id: v, name: v }));
  }
}

function Chip({
  label,
  caption,
  active,
  onPress,
}: {
  label: string;
  caption?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <EditorialText kind="bodySm" color={active ? palette.cream : palette.ink}>
        {label}
      </EditorialText>
      {caption ? (
        <EditorialText
          kind="caps"
          color={active ? palette.cream : palette.inkSoft}
        >
          {caption}
        </EditorialText>
      ) : null}
    </Pressable>
  );
}

export default function CoachVoiceScreen() {
  const { config, setConfig, reset } = useVoiceLab();
  const [previewLang, setPreviewLang] = useState("es");
  const [status, setStatus] = useState<string>("");

  const voices = voicesFor(config.provider);

  async function onPreview() {
    setStatus("Synthesizing…");
    try {
      const { audioBase64, contentType } = await previewVoice({
        languageCode: previewLang,
        config,
      });
      const ext = contentType === "audio/wav" ? "wav" : "mp3";
      const uri = (cacheDirectory ?? "") + `coach-voice-preview.${ext}`;
      await writeAsStringAsync(uri, audioBase64, {
        encoding: EncodingType.Base64,
      });
      setStatus("");
      await playOnce({ source: { uri } });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <Screen variant="gradient">
      <Stack.Screen
        options={{
          title: "Coach's voice",
          headerShown: true,
          headerStyle: { backgroundColor: palette.cream },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: "600" },
          headerBackTitle: "Profile",
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.note}
        >
          Pick how your coach sounds. Preview a sample, then it's used in every
          conversation.
        </EditorialText>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Provider
        </EditorialText>
        <View style={styles.row}>
          {PROVIDERS.map((p) => (
            <Chip
              key={p}
              label={PROVIDER_LABELS[p]}
              caption={PROVIDER_TAGLINES[p]}
              active={config.provider === p}
              onPress={() =>
                setConfig({
                  provider: p,
                  voiceId: voicesFor(p)[0]!.id,
                })
              }
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Voice
        </EditorialText>
        <View style={styles.row}>
          {voices.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              caption={VOICE_DESCRIPTORS[v.id]}
              active={config.voiceId === v.id}
              onPress={() => setConfig({ voiceId: v.id })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Speed
        </EditorialText>
        <View style={styles.row}>
          {TTS_SPEED_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={`${s}x`}
              active={config.speed === s}
              onPress={() => setConfig({ speed: s })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Tone
        </EditorialText>
        <View style={styles.row}>
          {TTS_STYLES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={config.style === s}
              onPress={() => setConfig({ style: s })}
            />
          ))}
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Preview language
        </EditorialText>
        <View style={styles.row}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              label={l.code}
              active={previewLang === l.code}
              onPress={() => setPreviewLang(l.code)}
            />
          ))}
        </View>

        <Pressable style={styles.previewBtn} onPress={onPreview}>
          <EditorialText kind="bodyMd" color={palette.cream}>
            ▶ Preview
          </EditorialText>
        </Pressable>
        {status ? (
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.status}
          >
            {status}
          </EditorialText>
        ) : null}

        <Pressable style={styles.resetBtn} onPress={reset}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Reset to default
          </EditorialText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xs, paddingBottom: 80 },
  note: { marginBottom: spacing.sm },
  label: { marginTop: spacing.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.coral,
  },
  chipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  previewBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  status: { marginTop: spacing.sm },
  resetBtn: { marginTop: spacing.md, alignItems: "center" },
});
```

- [ ] **Step 2: Typecheck the mobile app**

Run: `pnpm --filter @language-coach/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(tabs)/profile/voice-lab.tsx"
git commit -m "feat(mobile): Coach's voice screen with 4 providers + descriptors"
```

---

### Task 13: Regroup Profile into "Coach settings" + ungate the entry

**Files:**

- Modify: `apps/mobile/app/(tabs)/profile/index.tsx` (Coach section ~190-205; Dev section ~207-230)

- [ ] **Step 1: Rename the Coach section + add the Coach's voice row**

In `apps/mobile/app/(tabs)/profile/index.tsx`, replace the COACH section block (the `EditorialText` "Coach" header through its closing `</GlassCard>`, lines ~190-205) with:

```tsx
          {/* COACH SETTINGS section */}
          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.sectionLabel}
          >
            Coach settings
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg" style={styles.sectionCard}>
            <ProfileRow
              label="Coach's Memory"
              value="View & edit"
              onPress={() => router.push("/(tabs)/profile/memory")}
            />
            <ProfileRow
              label="Coach's voice"
              value="Choose & preview"
              onPress={() => router.push("/(tabs)/profile/voice-lab")}
              isLast
            />
          </GlassCard>
```

- [ ] **Step 2: Delete the Dev section**

Remove the entire `{__DEV__ && ( … )}` block (the DEV section, lines ~207-230), including its surrounding `<>…</>` fragment. The PLAN section that follows is unaffected.

- [ ] **Step 3: Typecheck the mobile app**

Run: `pnpm --filter @language-coach/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)/profile/index.tsx"
git commit -m "feat(mobile): Coach settings group with Coach's voice for everyone"
```

---

## Phase 4 — Full verification & handoff

### Task 14: Repo-wide green + manual device check

**Files:** none (verification only)

- [ ] **Step 1: Format, lint, typecheck, test across the monorepo**

Run (from `app/`):

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

Expected: all green. (`pnpm format` may rewrite files — if it does, `git add -A && git commit -m "chore: format"`.)

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/coach-voice-gemini-inworld
```

- [ ] **Step 3: Manual device verification (requires a dev build)**

With OpenAI/ElevenLabs keys already live (Gemini/Inworld optional until set):

1. Open the app → Profile. Confirm a **"Coach settings"** group shows **Coach's Memory** and **Coach's voice**, and the old **Dev → Voice Lab** entry is gone.
2. Tap **Coach's voice**. Title reads "Coach's voice"; no "Apply to live conversation" toggle.
3. Switch the provider chip across **OpenAI → ElevenLabs → Gemini → Inworld**; confirm the voice list and descriptors update and the first voice auto-selects.
4. With **OpenAI**, set a voice + speed + tone, choose a preview language, tap **Preview** → audio plays.
5. With **ElevenLabs**, **Preview** → audio plays.
6. (If `GEMINI_API_KEY` set) With **Gemini**, **Preview** → audio plays (WAV path). If unset, expect a clean error message in the status line; OpenAI/ElevenLabs still work.
7. (If `INWORLD_API_KEY` set) With **Inworld**, **Preview** → audio plays.
8. Pick a non-default voice, leave the screen, start a **practice conversation**, and confirm the coach speaks in the selected voice (config always applies now).
9. Tap **Reset to default** → returns to OpenAI/nova.

- [ ] **Step 4: Provider keys (Bruno, when ready to enable Gemini/Inworld)**

See the spec's "Key creation steps". After creating each key:

```bash
fly secrets set GEMINI_API_KEY=<key> -a my-language-coach-agentical-rebuild
fly secrets set INWORLD_API_KEY=<key> -a my-language-coach-agentical-rebuild
```

(Confirm the Fly app name with `fly apps list` if unsure.) Add the same keys to `apps/api/.env` for local testing.

---

## Self-review notes (for the implementer)

- **Spec coverage:** Part A → Tasks 10–13; Part B → Tasks 1–8; descriptors → Task 9. Key-creation steps → Task 14 Step 4.
- **Known-unknowns to verify during implementation (flagged in-task):** exact Gemini model id (Task 4), Inworld endpoint/auth/field names + voice IDs (Tasks 1 & 5). If reality differs, adjust the isolated constants and re-run that task's tests.
- **Type consistency:** `makeSynthesizeSpeech(deps)` deps object is used identically in Task 7 (definition + test) and Task 8 (call site). `synthesizeSpeechGemini(key, input)` / `synthesizeSpeechInworld(key, input)` signatures match their router calls. `useVoiceLab` exposes `{ config, setConfig, reset }` after Task 10 and is consumed that way in Tasks 11–12.

```

```
