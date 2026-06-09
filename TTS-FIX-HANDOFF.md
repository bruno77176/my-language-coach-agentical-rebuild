# Handoff: TTS "audio failed" fix — model/endpoint guidance

**From:** a parallel Claude Code session (at Bruno's request)
**Date:** 2026-06-03
**Action requested:** Read this, then confirm back to Bruno (in your chat) that you understood — he explicitly asked for your confirmation.

## Bruno's decision

He does **not** want a multi-provider fallback chain. He wants **one stable, robust Gemini voice — NOT a preview model.**

## Verified facts (Google docs, 2026-06-03)

- Current code: `apps/api/src/providers/gemini.ts:10` →
  `const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";`
  calling endpoint `generativelanguage.googleapis.com/v1beta` (Gemini **Developer** API / AI Studio).
- On the **Gemini Developer API** (`generativelanguage.googleapis.com`), **EVERY** TTS model is preview-only:
  `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`.
  → There is **no** stable/GA Gemini TTS on this endpoint. A pure model-string rename cannot give a non-preview model here.
- The **GA (stable, SLA-backed)** Gemini TTS models exist only on **Google Cloud Text-to-Speech / Vertex AI**:
  - `gemini-2.5-flash-tts` — **GA** — low latency, cost-efficient → **recommended for this real-time coach**
  - `gemini-2.5-pro-tts` — **GA** — higher fidelity, slower/pricier (podcast/audiobook tier)

## Why the live build is failing (root cause stands)

Preview model = low rate limits. Each coach turn fires multiple concurrent chunk-synthesis calls → bursts past the preview throttle → most chunks return throttled → "(Audio failed — read above)". Billing/auth are fine.

## Recommended fix (the stable answer Bruno asked for)

Point the Gemini TTS provider at **Cloud Text-to-Speech / Vertex AI** using the GA model **`gemini-2.5-flash-tts`**.

- This is an **endpoint + auth change** (Cloud service-account creds, not the AI-Studio API key), plus request/response shape differences — NOT a one-line model rename. Plan accordingly.
- Server-only change → repairs already-installed build 22 without a new store release.
- Heads-up: build 22 sends the model id from the client each turn. The server must **ignore/override** the client-sent model and force `gemini-2.5-flash-tts`, or installed phones keep requesting preview.

## Interim mitigation (ONLY if a same-day patch is needed, NOT the stable solution)

Staying on the Developer API, swap `gemini-3.1-flash-tts-preview` → `gemini-2.5-flash-preview-tts` (older, more-seasoned preview, possibly higher limits). Still preview, still not what Bruno ultimately wants — treat as a stopgap, not the fix.

## Sources

- https://docs.cloud.google.com/text-to-speech/docs/gemini-tts (GA vs preview list)
- https://ai.google.dev/gemini-api/docs/models (Developer API = preview-only TTS)
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd

---

**Please reply to Bruno confirming you read and understood this — he is waiting for that confirmation.**
