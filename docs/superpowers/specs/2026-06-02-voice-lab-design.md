# Voice Lab — on-device TTS experimentation (design)

**Date:** 2026-06-02
**Status:** Approved, pending implementation plan
**Author:** Bruno + Claude

## Problem

The coach voice is now linguistically correct (the wrong-language bug is fixed via
`gpt-4o-mini-tts` + an explicit language instruction — see
`reference_tts_language_gotcha`). But Bruno finds the OpenAI voice **too slow and not
natural**, the same reason a previous `gpt-4o-mini-tts` switch was reverted. He doesn't
yet know which speed / tone / voice / engine actually sounds good, and generating probe
`.mp3` files offline is a poor way to judge a voice — the "too slow / not natural" feeling
only really bites **in a live conversation**, on the device.

He wants to **experiment live on the app**: try different speeds, tones, voices, and swap
the underlying TTS engine (e.g. toggle ElevenLabs), then settle on what's good. Premium
engines (ElevenLabs) may later be a paid-tier feature ("never marry one model" —
`project_model_benchmarking`).

## Goal

A **private, dev-only "Voice Lab"** that lets Bruno change the TTS provider, voice, speed,
and tone from inside the app and hear the result — both as an instant preview sample and
in a real back-and-forth coaching conversation.

This is a **testing tool first**. Productizing it (user-facing setting, Pro-tier gating,
persistence) is a later phase, explicitly out of scope here.

## Scope

### In scope (v1)
- Backend: a provider-agnostic TTS **router** (OpenAI + ElevenLabs) driven by a `TtsConfig`.
- Backend: a `POST /v1/voice/preview` endpoint returning a sample in any config.
- Backend: the live turns endpoint accepts an optional `voice_config` override.
- Mobile: a `__DEV__`-only Voice Lab screen (provider / voice / speed / tone / preview),
  with config stored on-device and attached to live turns.

### Out of scope (YAGNI — "productize later")
- DB persistence / a `profiles` voice column.
- Pro / free tier gating of engines.
- Google Cloud TTS provider.
- The full ElevenLabs voice library (we ship a curated handful).
- Production-polished UI — this is a dev screen.

## Engines (v1)
- **OpenAI** — ready; `synthesizeSpeechOpenAI` already exists.
- **ElevenLabs** — `synthesizeSpeech` provider module already exists; needs `language_code`
  + `voice_settings` wiring. **Prerequisite:** Bruno's ElevenLabs key is currently at
  0/20 credits; it must be topped up to test ElevenLabs live.

## Architecture

### `TtsConfig`
```
type TtsProvider = "openai" | "elevenlabs";
type TtsConfig = {
  provider: TtsProvider;
  voiceId: string;       // provider-specific
  speed: number;         // 0.7–1.3, default 1.0
  style?: string;        // tone preset key: warm | cheerful | calm | serious | energetic
};
```
A `DEFAULT_TTS_CONFIG` (`openai` · `nova` · `speed 1.0` · `warm`) reproduces today's
behavior, so any path with no override is unchanged.

### Router
`synthesizeSpeech({ text, languageCode, config?, onUsage })` dispatches by
`config.provider` (defaulting to `DEFAULT_TTS_CONFIG`). It replaces the direct
`synthesizeSpeechOpenAI` wiring in `app.ts`. Provider modules:

- **OpenAI** (`synthesizeSpeechOpenAI`, extended): build the `instructions` string from
  `languageCode` + `style` preset + a pace clause derived from `speed`. Apply the native
  `speed` param **if `gpt-4o-mini-tts` honors it**; otherwise encode pace entirely in the
  instruction. (Implementation must verify native `speed` support and pick one — documented
  in the plan.)
- **ElevenLabs** (extended): `textToSpeech.stream(voiceId, { text, modelId:
  "eleven_flash_v2_5", languageCode, voiceSettings: { speed, stability, style },
  outputFormat })`. Usage operation stays `tts:eleven_flash_v2_5` (rate card already seeded).

Style presets are a small fixed map (key → OpenAI instruction phrase / ElevenLabs style
value), centralised so both providers read from one source.

### Endpoints
- **`POST /v1/voice/preview`** — body `{ languageCode, config, text? }`. Missing `text` →
  a fixed per-language sample sentence. Returns `{ audioBase64, contentType }` (no storage
  writes). Auth-required; no daily quota (dev tool).
- **`POST /v1/voice/sessions/:id/turns`** — accepts an optional `voice_config` multipart
  field (JSON). Parsed + zod-validated; passed to the router. Absent/invalid → default.

### Mobile
- Entry: a `__DEV__`-only "🎛 Voice Lab" row in Profile (absent from production builds).
- Controls: provider segmented control · voice picker (per-provider list) · speed slider
  (0.7–1.3) · tone chips (Warm / Cheerful / Calm / Serious / Energetic) · ▶ Preview.
- Config in a small store persisted to AsyncStorage. `use-conversation` reads it and
  attaches `voice_config` to each turn request when set. A note tells Bruno it also
  applies to his next coach reply.

## Data flow
1. Lab screen sets config → persisted on device.
2. **Preview:** Lab → `POST /voice/preview { config, languageCode }` → base64 mp3 → play.
3. **Live:** `use-conversation` builds the turn → attaches `voice_config` → router →
   provider → audio chunks (unchanged downstream).

## Error handling
- Backend zod-validates `config`; unknown provider/voice or junk → fall back to
  `DEFAULT_TTS_CONFIG` (never break a turn).
- ElevenLabs failure (e.g. 0-credit key → 401) is **surfaced clearly** in preview
  ("ElevenLabs: quota exceeded — top up credits") and via the existing
  `TTS_PROVIDER_FAILURE` (retryable) path for live turns. **No silent fallback to OpenAI** —
  that would make lab comparisons misleading.

## Testing
- Backend unit tests:
  - router dispatches to the correct provider;
  - default config (no override) reproduces current OpenAI + language-instruction call;
  - OpenAI extension builds instruction from style + pace and applies speed;
  - ElevenLabs extension passes `language_code` + `voice_settings`;
  - `/voice/preview` returns audio for a config (and for the default sample text);
  - turns endpoint parses + validates `voice_config`, junk → default.
- Existing voice-turn / greeting / message-audio tests stay green (default path unchanged).
- Mobile: manual on-device verification (no RN test runner).

## Open implementation questions (resolve in the plan, not blocking design)
- Does `gpt-4o-mini-tts` honor the native `speed` param, or must pace live entirely in the
  instruction? Verify empirically.
- Final curated ElevenLabs voice list + the per-provider OpenAI voice list to expose.
- Exact ElevenLabs `voice_settings` ranges (stability/style) to map the tone presets onto.
