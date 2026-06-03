# Coach's Voice settings + Gemini & Inworld TTS providers — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorming) → ready for implementation plan
**Related:** `docs/superpowers/research/2026-05-28-tts-model-landscape.md` (TTS landscape research that motivated the provider choices)

## Summary

Two changes, shipped together:

1. **Promote the dev-only "Voice Lab" into a normal, everyone-facing setting.** It moves under a
   **"Coach settings"** group on the Profile screen as **"Coach's voice"**, alongside the existing
   **"Coach's Memory"**. The dev-only `__DEV__` gating and the "Apply to live conversation" override
   toggle are removed — the voice a user picks always becomes their coach's voice.
2. **Add two new TTS providers** to that screen (and the backend that powers it): **Google Gemini 3.1
   Flash TTS** and **Inworld TTS 1.5 Max**, alongside the existing OpenAI and ElevenLabs.

Free-tier vs Pro-tier gating is explicitly **out of scope** — Bruno will decide later. For now the
screen and all four providers are visible to everyone.

## Motivation

The Voice Lab was built as a developer A/B tool. Bruno wants real users to choose their coach's voice,
and wants the two top-of-leaderboard providers (Gemini #1, Inworld #2 per the May 2026 Artificial
Analysis Speech Arena) available so the app isn't married to a single TTS vendor (see the
model-benchmarking thread). Promoting the lab and widening provider choice are the same release.

---

## Part A — Promote Voice Lab → "Coach's voice" setting (mobile only)

No backend changes in this part.

### A1. Profile screen — `apps/mobile/app/(tabs)/profile/index.tsx`

- Rename the existing **"Coach"** section header to **"Coach settings"**.
- That group keeps the existing **"Coach's Memory"** row (→ `/(tabs)/profile/memory`, unchanged) and
  gains a new **"Coach's voice"** row (→ the existing voice screen route).
- **Delete the entire `__DEV__`-gated "Dev" section** (lines ~207–230), which currently holds the only
  link to Voice Lab. The link now lives in the Coach settings group and is visible to everyone.

Row to add (mirrors existing `ProfileRow` usage):

```tsx
<ProfileRow
  label="Coach's voice"
  value="Choose & preview"
  onPress={() => router.push("/(tabs)/profile/voice-lab")}
  isLast
/>
```

(Coach's Memory loses `isLast`; Coach's voice becomes the last row in the group.)

### A2. The screen — `apps/mobile/app/(tabs)/profile/voice-lab.tsx`

Keep the route/file name (`voice-lab`) to avoid churn; only user-facing strings and behavior change.

- **Title:** `"🎛 Voice Lab"` → `"Coach's voice"`. Remove the "Dev tool — …" note paragraph; replace
  with a one-line user-facing description, e.g. *"Pick how your coach sounds. Preview, then it's used
  in every conversation."*
- **Remove** the entire "Apply to live conversation" label + ON/OFF chip block.
- **Keep** Provider, Voice, Speed, Tone, Preview language (all 12 languages), Preview button, and
  "Reset to default".
- **Provider chips:** render all four — `["openai", "elevenlabs", "gemini", "inworld"]`. Use friendly
  display labels (see A4), not the raw enum value.
- **Voice list:** select catalog by provider:
  - `openai` → `OPENAI_TTS_VOICES`
  - `elevenlabs` → `ELEVENLABS_TTS_VOICES`
  - `gemini` → `GEMINI_TTS_VOICES`
  - `inworld` → `INWORLD_TTS_VOICES`
- **On provider change:** reset `voiceId` to that provider's first voice.
- **Friendly descriptors:** show a small caption under each voice chip (and a provider tagline under
  the provider row) sourced from `voice-meta.ts` (A4).
- **Preview audio:** the preview currently writes to `voice-lab-preview.mp3`. Gemini returns WAV, so
  write to a file whose extension matches the audio. `previewVoice` **already** returns `contentType`
  (the `/v1/voice/preview` endpoint returns `{ audioBase64, contentType }`) — derive the file
  extension from it (`audio/wav` → `.wav`, else `.mp3`) so playback is reliable across providers.

### A3. Store — `apps/mobile/src/features/voice-lab/voice-lab-store.ts`

- Remove `overrideEnabled` and `setOverrideEnabled`.
- Keep `config`, `setConfig`, `reset` (reset returns `config` to `DEFAULT_TTS_CONFIG`).
- Keep the persist key `"voice-lab.v1"` — zustand ignores the now-absent `overrideEnabled` field in
  any previously persisted blob, so no migration is needed.

### A4. Voice metadata — `apps/mobile/src/features/voice-lab/voice-meta.ts` (new)

Mobile-only, kept out of `packages/shared` (the backend doesn't need descriptors).

- `PROVIDER_LABELS: Record<TtsProvider, string>` — e.g. `openai: "OpenAI"`, `elevenlabs: "ElevenLabs"`,
  `gemini: "Gemini"`, `inworld: "Inworld"`.
- `PROVIDER_TAGLINES: Record<TtsProvider, string>` — user-facing, no metrics. e.g.
  `openai: "Natural & expressive"`, `elevenlabs: "Ultra-realistic"`, `gemini: "Crisp & lifelike"`,
  `inworld: "Warm & conversational"`.
- `VOICE_DESCRIPTORS: Record<string /*voiceId*/, string>` — e.g. `nova: "Bright & friendly"`,
  `shimmer: "Soft & warm"`, `Kore: "Firm & confident"`, etc. Missing entries render no caption.

### A5. Live-conversation consumer — `apps/mobile/src/features/practice/use-conversation.ts`

Line ~268–269 changes from override-gated to always-apply:

```ts
const voiceOverride = useVoiceLab.getState().config;
```

(`config` defaults to `DEFAULT_TTS_CONFIG` = OpenAI/nova, which equals current backend default, so
existing users see no regression.)

---

## Part B — Add Gemini & Inworld TTS providers

### B1. Shared types — `packages/shared/src/tts-config.ts`

- `export type TtsProvider = "openai" | "elevenlabs" | "gemini" | "inworld";`
- Add catalogs (same `{ id, name }` shape as `ELEVENLABS_TTS_VOICES`):
  - `GEMINI_TTS_VOICES` — prebuilt voice names (id === name): **Kore, Puck, Charon, Aoede, Leda,
    Orus**. Gemini voices are language-agnostic; the model speaks whatever language is requested.
  - `INWORLD_TTS_VOICES` — ~5 curated voices. **Exact voice IDs to be verified against Inworld's
    voice-list endpoint during implementation** and kept in this single constant. Initial candidates:
    Ashley, Olivia, Mark, Hades, Sarah.
- Export both from `packages/shared/src/index.ts`.

### B2. Backend config helpers — `apps/api/src/providers/tts-config.ts`

- Widen the zod enum: `provider: z.enum(["openai", "elevenlabs", "gemini", "inworld"])`.
- Reuse `openAiStylePhrase` + `pacePhrase` for Gemini (prose-based style/pace).
- Add an Inworld style→params mapping if needed (e.g. a small `inworldStyleSettings(style)` returning
  any provider-specific knobs); keep it minimal — speed maps to `speakingRate`.

### B3. Gemini provider — `apps/api/src/providers/gemini.ts` (new)

- `synthesizeSpeechGemini(apiKey: string | undefined, input: SynthesizeInput): Promise<TtsResult>`.
- If `apiKey` is falsy → throw `ProviderError("TTS_PROVIDER_NOT_CONFIGURED", 503, "Gemini API key not
  configured")`.
- Call the Gemini API `generateContent` (REST via `fetch`) for model
  `gemini-3.1-flash-tts` (held in a single editable `GEMINI_TTS_MODEL` constant — model id may need a
  tweak once verified against the live API), with:
  - `contents`: a prose instruction prefix built from `openAiStylePhrase(style)` + `pacePhrase(speed)`
    + target-language hint + the text. (Gemini TTS has no native `speed` param, so pace is conveyed in
    the instruction.)
  - `generationConfig.responseModalities: ["AUDIO"]`
  - `generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName: input.voiceId`
- Response inline audio is **PCM (signed 16-bit LE, 24 kHz, mono)**. Wrap it with `pcmToWav(...)` (B5)
  and return `{ audioBuffer, contentType: "audio/wav" }`.
- Fire `onUsage({ provider: "gemini", operation: "tts:gemini-3.1-flash-tts", characters:
  input.text.length })` (fire-and-forget, matching ElevenLabs).
- On API error → `ProviderError("TTS_PROVIDER_FAILURE", 503, "Gemini error: …")`.

### B4. Inworld provider — `apps/api/src/providers/inworld.ts` (new)

- `synthesizeSpeechInworld(apiKey: string | undefined, input: SynthesizeInput): Promise<TtsResult>`.
- If `apiKey` falsy → `ProviderError("TTS_PROVIDER_NOT_CONFIGURED", 503, ...)`.
- `POST https://api.inworld.ai/tts/v1/voice` (REST via `fetch`) with `Authorization` per Inworld's
  scheme (Basic/Bearer — confirm at implementation), body including:
  - `text: input.text`
  - `voiceId: input.voiceId`
  - `modelId: "inworld-tts-1.5"` (the Max tier; held in an editable `INWORLD_TTS_MODEL` constant)
  - `audioConfig: { audioEncoding: "MP3", speakingRate: clamp(input.speed) }`
  - language hint via the appropriate field if supported.
- Response: base64 MP3 → `{ audioBuffer: Buffer.from(b64, "base64"), contentType: "audio/mpeg" }`.
- Fire `onUsage({ provider: "inworld", operation: "tts:inworld-tts-1.5", characters: text.length })`.
- On error → `ProviderError("TTS_PROVIDER_FAILURE", 503, "Inworld error: …")`.

### B5. PCM→WAV helper — `apps/api/src/providers/audio.ts` (new)

- `pcmToWav(pcm: Buffer, opts?: { sampleRate?: number; channels?: number; bitsPerSample?: number }):
  Buffer` — prepend a 44-byte canonical WAV header (defaults: 24000 Hz, mono, 16-bit). Pure function,
  unit-tested.

### B6. Router refactor — `apps/api/src/providers/tts-router.ts`

The current positional signature (`openai, eleven, openAiSynth, elevenSynth`) doesn't scale to four
providers. Refactor `makeSynthesizeSpeech` to take a single **deps object**:

```ts
type TtsDeps = {
  openai: OpenAI;
  eleven: ElevenLabsClient;
  geminiKey?: string;
  inworldKey?: string;
  // injectable synth overrides for tests; default to the real provider fns
  synth?: {
    openai?: (c: OpenAI, i: TtsInput) => Promise<TtsResult>;
    eleven?: (c: ElevenLabsClient, i: SynthesizeInput) => Promise<TtsResult>;
    gemini?: (key: string | undefined, i: SynthesizeInput) => Promise<TtsResult>;
    inworld?: (key: string | undefined, i: SynthesizeInput) => Promise<TtsResult>;
  };
};

export function makeSynthesizeSpeech(deps: TtsDeps): (input: RoutedTtsInput) => Promise<TtsResult>;
```

Dispatch on `config.provider` across all four. Update the one call site in `app.ts` and the existing
`tts-router` test to the new shape.

### B7. Env — `apps/api/src/env.ts`

Add, as **optional** (so the running Fly API doesn't crash before keys exist):

```ts
GEMINI_API_KEY: z.string().optional(),
INWORLD_API_KEY: z.string().optional(),
```

Pass `env.GEMINI_API_KEY` / `env.INWORLD_API_KEY` into `makeSynthesizeSpeech` deps in `app.ts`. Keys
are set as **Fly secrets** (`fly secrets set …`) once created — never bundled into the mobile app
(per repo convention: no API keys on device).

### B8. Tests

Mirror existing provider test patterns:
- `audio.test.ts` — `pcmToWav` header bytes + length.
- `gemini.test.ts` — mocked `fetch`: success returns WAV; missing key → `TTS_PROVIDER_NOT_CONFIGURED`;
  API error → `TTS_PROVIDER_FAILURE`.
- `inworld.test.ts` — mocked `fetch`: success returns MP3; missing key / API error cases.
- `tts-router.test.ts` — dispatch routes each of the four providers to the right (stubbed) synth fn.

---

## Key creation steps (Bruno, after merge / before testing)

**Gemini API key (AI Studio — distinct from the legacy GCP Cloud TTS key):**
1. Go to <https://aistudio.google.com/app/apikey>.
2. "Create API key" → pick a project (or new). Copy the key.
3. `fly secrets set GEMINI_API_KEY=… -a my-language-coach-agentical-rebuild` (and add to local
   `apps/api/.env` for local testing).

**Inworld API key:**
1. Sign up at <https://inworld.ai> → developer portal / API keys.
2. Create a key (note Basic vs Bearer auth scheme; confirm against current docs).
3. `fly secrets set INWORLD_API_KEY=… -a my-language-coach-agentical-rebuild` (and local `.env`).

Until each key is set, that provider returns a clean `TTS_PROVIDER_NOT_CONFIGURED` 503; OpenAI and
ElevenLabs keep working.

## Out of scope (deferred)

- Free-tier vs Pro-tier gating of providers/voices (Bruno decides later).
- Self-hosted open models (Kokoro / Fish Audio) as a cost lever.
- Per-provider voice cloning; live pricing fetch; renaming the internal `voice-lab` route/folder.

## Verification

- `pnpm format && pnpm lint && pnpm typecheck` green across the monorepo (per CI-green rule).
- API unit tests pass (`pnpm --filter @language-coach/api test` or repo equivalent).
- Manual: on device, Profile → Coach settings → Coach's voice; switch among all four providers, pick a
  voice, Preview in the target language, confirm playback; start a practice conversation and confirm
  the coach speaks in the selected voice. Gemini/Inworld require their keys set; without keys they
  surface a clean error and the others still work.
