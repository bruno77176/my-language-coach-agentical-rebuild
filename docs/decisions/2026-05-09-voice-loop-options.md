# Voice loop architecture — options compared

**Date:** 2026-05-09
**Status:** Decided — option 1 (streaming pipeline) for MVP. Option 2 reserved as upgrade path for the paid tier.
**Context:** This document records the three voice-architecture options considered for the rebuild and why we chose what we chose, so we can revisit the decision when planning the paid tier.

The voice conversation loop is the heart of the app. The three viable architectures in 2026 differ on latency, cost, complexity, and testability.

---

## Option 1 — Streaming pipeline (chosen for MVP)

**Shape:** mobile mic → Deepgram streaming STT → GPT-4o-mini streaming → ElevenLabs streaming TTS → playback. Each stage is a separate HTTP/WebSocket call. The first generated sentence starts playing back through TTS while the LLM is still producing the rest.

**Latency:** ~1-3 s end-to-end perceived (first audio out of TTS), versus ~5-10 s if we waited for the full LLM response before TTS.

**Cost (estimated, as of mid-2026):**

| Stage     | Provider                  | Rate                          | Per minute of conversation |
| --------- | ------------------------- | ----------------------------- | -------------------------- |
| STT       | Deepgram Nova-3 streaming | ~$0.0043/min audio in         | ~$0.004                    |
| LLM       | OpenAI GPT-4o-mini        | $0.15/M input, $0.60/M output | ~$0.05-0.10                |
| TTS       | ElevenLabs (Flash v2.5)   | ~$0.18/1k chars               | ~$0.04                     |
| **Total** |                           |                               | **~$0.10-0.15/min**        |

**Complexity:** moderate. Three providers, three SDKs, but each is a well-documented API with clear request/response boundaries. Failures are isolated (STT failure ≠ TTS failure). VAD is configurable (Deepgram supports endpoint detection so push-to-talk is optional).

**Testability:** high. Each stage is mockable with MSW. Integration tests can use real APIs against test fixtures. The audio pipeline is the hardest part to test (still needs device-level testing) but each transformation is verifiable in isolation.

**iOS audio session:** still a concern (mic capture + playback) but simpler than option 2 — uses standard `expo-audio` with one session transition (record → playback).

**Why we chose this for MVP:** best balance of UX, cost, and engineering complexity for a solo developer building a tested codebase. Fits the "simple and lean" + "fully tested" + "professional grade" goals without the per-user cost or integration complexity of option 2.

---

## Option 2 — OpenAI Realtime API over WebRTC

**Shape:** mobile WebRTC peer connection ↔ OpenAI Realtime endpoint. Voice in, voice out, single bidirectional stream. The model handles transcription, response generation, and speech synthesis as one operation.

**Latency:** sub-500 ms turn-taking — the model can start replying as soon as it detects the user has stopped speaking (built-in server-side VAD). Indistinguishable from a real call.

**Cost (estimated, mid-2026):**

| Direction    | Rate       | Per minute     |
| ------------ | ---------- | -------------- |
| Audio input  | ~$0.06/min | $0.06          |
| Audio output | ~$0.24/min | $0.24          |
| **Total**    |            | **~$0.30/min** |

That's roughly 2-3× option 1 per minute of conversation. Reasonable for paid users; expensive for a free tier.

**Complexity:** high. Requires `react-native-webrtc` (a heavy native dep), ephemeral key minting on the backend (the device must never hold a long-lived OpenAI key), session resume / reconnect logic for spotty mobile connections, and a tighter coupling to OpenAI's product roadmap. WebRTC also brings its own connection-state machine that has to be handled in the UI (connecting / connected / reconnecting / failed).

**Testability:** low. WebRTC is opaque from a unit-test perspective — you can mock the SDK but you can't really test the audio path. Integration testing requires real device audio.

**iOS audio session:** simpler than option 1 — a single bidirectional stream means one session category for the whole call, no record↔playback transitions.

**Why we deferred this:** the per-minute cost makes a free tier expensive to subsidize, and the WebRTC complexity is not worth taking on before product-market fit is confirmed. Reserved as the upgrade path for paid users where the latency premium justifies the cost premium.

**When to revisit:** once MVP has paying customers and we're designing the paid offer. Also revisit if OpenAI lowers Realtime pricing materially or adds an "audio mini" tier.

---

## Option 3 — Legacy-style pipeline (rejected)

**Shape:** record full audio clip → POST to backend → Whisper transcription → GPT-4o response → OpenAI TTS → return base64 audio → playback. No streaming. Push-to-talk only.

**Latency:** ~3-5 s end-to-end, all spent waiting silently after the user stops speaking. This is what the legacy app does.

**Cost:** cheapest of the three at ~$0.05/min, mostly because Whisper is cheap (~$0.006/min) and OpenAI TTS standard tier is competitive (~$15/M chars).

**Complexity:** lowest. All HTTP, no streaming, no WebRTC, no WebSocket session management.

**Testability:** highest. Pure request/response at every stage.

**Why we rejected this:** the UX is bad. The legacy app's "user presses mic, releases, then waits silently for 5 seconds" was the most consistent friction point. We're rebuilding partly to fix this; reverting to the same pipeline defeats the purpose.

**When to revisit:** never, for the conversational use case. _Could_ be useful for non-conversational features (e.g., "pronounce this word for me") where latency matters less.

---

## Decision summary

|                           | Latency | Cost/min   | Complexity | Testability | Choice                    |
| ------------------------- | ------- | ---------- | ---------- | ----------- | ------------------------- |
| **1. Streaming pipeline** | 1-3 s   | $0.10-0.15 | Medium     | High        | **MVP (free + paid)**     |
| **2. Realtime API**       | <500 ms | $0.30      | High       | Low         | **Future (paid premium)** |
| **3. Legacy pipeline**    | 3-5 s   | $0.05      | Low        | Highest     | Rejected                  |

The paid offer is undefined as of this writing; the most likely shape is "free tier on option 1, premium tier on option 2 with unlimited minutes". To be brainstormed after MVP ships.
