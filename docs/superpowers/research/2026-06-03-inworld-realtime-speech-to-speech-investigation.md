# Inworld Realtime API (Speech-to-Speech) — Investigation

**Date:** 2026-06-03
**Trigger:** Bruno saw "Speech to Speech — have a realtime conversation with maximum naturalness and
minimal latency" in the Inworld onboarding and asked whether we should explore it. That tagline is
*exactly* the product goal for the practice loop.
**Status:** Investigation only — not a commitment. Feeds a future plan (likely Plan 8+).
**Related:** [[project-model-benchmarking]], the merged 4-provider TTS work (PR #30),
`docs/superpowers/research/2026-05-28-tts-model-landscape.md`, [[project-coach-memory-feature]].

---

## TL;DR

Inworld's "Speech-to-Speech" is exposed as their **Realtime API**: STT + LLM + TTS unified behind a
**single WebSocket**, **sub-1s end-to-end** voice-to-voice, with native VAD / end-of-turn / barge-in.

The crucial finding for us: **it is a *cascaded* pipeline, not an opaque native audio model.** That
means:

- ✅ **We keep our own LLM and system prompt** — Inworld is model-agnostic (OpenAI, Anthropic, Google,
  Groq, Mistral, xAI via their router); instructions set via `session.update`.
- ✅ **We keep the text transcript** (streaming STT partials + final), which a language coach *needs*
  for corrections, translation, end-of-session feedback, and coach-memory extraction.
- ✅ We gain the hard parts for free: semantic VAD, interruption/barge-in, streaming, cancellation —
  all handled server-side.

This is a **better fit for a language coach than native audio-to-audio S2S** (OpenAI Realtime / Gemini
Live), because native models hide the text and make "you said X → the correct form is Y" hard.

**The cost is architectural:** it replaces our turn-based record→upload→respond loop with a duplex
streaming WebSocket, which is a meaningful mobile + backend rework. Recommendation: **prototype behind
a flag for Pro**, don't rip out the current loop.

---

## What "Speech-to-Speech" means

Two architectures get marketed under the same words:

| | **Cascaded** (STT → LLM → TTS) | **Native audio-in/audio-out** |
|---|---|---|
| Examples | Inworld Realtime API, LiveKit/Pipecat stacks | OpenAI Realtime, Gemini Live |
| Text transcript | **Exposed** (partials + final) | Hidden / lossy |
| Own LLM + system prompt | **Yes** | No (the model *is* the LLM) |
| Prosody/emotion fidelity | Good (steering tags + voice-profile signals) | Best (no text bottleneck) |
| Latency | Sub-1s achievable with streaming | Lowest (no intermediate text) |
| Control / transparency | High | Low |

Inworld is firmly in the **cascaded-but-unified** camp: one endpoint, but each stage is real and
inspectable. For a coaching product where the *text* is the teachable artifact, that transparency is
the whole game.

## How Inworld's Realtime API works (from their docs/marketing, 2026-06)

- **One WebSocket** carries the full loop. "The only Realtime API where STT voice profile, LLM
  steering, and Realtime TTS-2 expressive output run as one WebSocket call."
- **STT emits paralinguistic signals** (emotion, age, accent, speaking rate) *alongside* each
  transcript chunk → injected into LLM context.
- **The LLM emits inline Realtime TTS-2 "steering tags"** — `[whisper]`, `[sigh]`, `[laugh]`,
  `[speak softly]` — consumed by TTS in the same stream for expressive output.
- **Latency:** "end-to-end speech-to-speech latency under one second." Component breakdown they quote:
  STT ~200ms, LLM ~400ms, TTS ~180ms. (TTS first-audio P90: <250ms Max, <130ms Mini.)
- **Bring your own LLM:** "Pick any LLM for the conversation engine. Swap providers without changing
  your integration." Providers: OpenAI, Anthropic, Google, Groq, Mistral, xAI (via Inworld Router,
  200+ models). System prompt/instructions via `session.update`.
- **Turn-taking:** context-aware **semantic VAD** (intent-boundary, not silence-based) with adjustable
  eagerness; graceful **barge-in** ("no awkward overlaps or cut-offs"); cancellation native.
- **Transport:** WebSocket GA; **WebRTC + SIP in early access**. Full-duplex.
- **Languages:** "supports the languages available through the underlying models you select" (no fixed
  list — depends on chosen STT/LLM/TTS).
- **Pricing:** "from $0.015/min"; you pay underlying model usage (TTS at the same $5/$10 per 1M chars
  as standalone). **Default concurrency: 20 conversations, 1,000 req/s** — fine early, a ceiling to
  watch at scale (raisable on request).
- **Privacy:** zero data retention on the TTS models; instant (zero-shot) voice cloning from 5–15s.

## Why this matters for a language coach (fit analysis)

**Strong fit:**
- The product goal *is* "realtime conversation, maximally natural, minimal latency." This is purpose-built for that.
- We keep the **coaching brain** — our scenario prompts, correction logic, persona, and the
  swappable LLM (today OpenAI; the benchmarking thread wants optionality — this preserves it).
- We keep **transcripts**, so everything downstream still works: inline translate, end-of-session
  feedback, coach-memory extraction, usage metering by characters.
- **Barge-in** is a real pedagogical win: learners can interrupt, the coach can let them finish a
  sentence — far more lifelike than our current strict turn-taking.
- Paralinguistic STT signals (accent, rate, emotion) could later power **pronunciation/fluency
  feedback** — overlaps with the Plan 8 "store user audio for pronunciation review" idea
  ([[project-plan-8-ideas]]).

**Tensions / costs:**
- **Architecture rework.** Our loop today is turn-based: `react-native` mic record → multipart upload
  → Deepgram STT → OpenAI LLM → provider TTS, mediated entirely by our Fly API. Realtime is a
  **duplex streaming WebSocket**. Mobile audio capture, playback, and state all change.
- **Key handling / proxy.** Mobile must not hold the Inworld key (repo rule: no keys on device).
  Either (a) our API **proxies the WebSocket** (server relays frames; keeps keys server-side; lets us
  keep metering/quota/memory hooks), or (b) Inworld issues **ephemeral client tokens** and mobile
  connects directly (lower latency, but we lose the central choke point for metering/safety unless
  Inworld reports usage we can reconcile). **Proxy is the safer default given our quota + memory
  needs.**
- **Discrete-turn features.** Per-message UI (repeat button, translate-this-message, share, the
  message list itself) assumes bounded turns. Streaming needs a turn-segmentation story so each
  finalized coach/user utterance still becomes a "message" row.
- **Cost model shift.** Per-minute realtime vs current per-component billing; the 20-concurrency
  default caps simultaneous Pro sessions early.
- **Vendor concentration.** STT+orchestration+TTS all on Inworld (LLM stays swappable). Mitigated by
  Inworld being model-agnostic and by keeping the existing cascaded loop as a fallback.
- **Maturity.** WebRTC/SIP still early access; WebSocket is the only GA transport today.

## Integration options (sketch — for a future plan, not now)

1. **Status quo, tuned.** Keep turn-based; shave latency (stream TTS by sentence, parallelize STT/LLM).
   Cheapest; doesn't deliver true barge-in or "maximum naturalness." *Baseline.*
2. **Inworld Realtime via our API proxy (recommended to prototype).** Backend opens the Inworld
   WebSocket, relays audio frames to/from mobile over our own WS, keeps the key server-side, and taps
   the transcript/usage stream for metering + memory + feedback. Mobile gets a streaming mic/playback
   client. **Pro-only, behind a flag**, current loop stays for Free + fallback.
3. **Direct mobile ↔ Inworld with ephemeral tokens.** Lowest latency; our API only mints short-lived
   tokens and reconciles usage from Inworld reports. More vendor trust, less central control. Consider
   only if proxy latency proves too high.

Compare-also: **OpenAI Realtime** and **Gemini Live** (native S2S) — likely *more* natural prosody but
they hide the transcript and the LLM, which fights our coaching needs. Worth a side-by-side latency +
"does it expose usable text" test before committing.

## Open questions to resolve before a plan

1. **Transcript shape:** does the WS emit clean final user + coach transcripts we can persist as
   message rows, with timestamps? (Need to confirm in `docs.inworld.ai`.)
2. **Proxy latency:** how much does relaying through Fly (tiny 256MB shared machine — see
   [[reference-fly-machine-tiny]]) add? Realtime relay may need a bigger/region-pinned machine.
3. **Usage reporting:** does Inworld report per-session characters/minutes we can feed into our
   existing `recordUsage` + quota system?
4. **Steering tags vs our prompts:** do TTS-2 steering tags interfere with showing clean coach text to
   the learner (we'd need to strip tags from the displayed message)?
5. **Languages:** confirm coverage for our 12 supported languages across the chosen STT/LLM/TTS combo
   (note [[reference-deepgram-nova3-no-chinese]]-style gaps may exist on Inworld STT too).
6. **Free vs Pro economics:** at $0.015/min + concurrency 20, model the cost of offering this to Pro
   only, with the current loop for Free.

## Recommendation

Pursue it as a **Pro-tier "Live conversation" mode prototyped behind a flag (Option 2)** — it directly
serves the stated goal and, unlike native S2S, keeps the text our coaching depends on. Do **not**
replace the current turn-based loop; run them side by side. Before writing a plan, spike the open
questions above (especially transcript shape + proxy latency) and do a quick A/B against OpenAI
Realtime / Gemini Live for naturalness-vs-control. This belongs in a dedicated brainstorm → spec →
plan cycle, not folded into the current TTS-providers PR.

## Sources

- Inworld Realtime API — <https://inworld.ai/realtime-api>
- Best Speech-to-Speech APIs (2026) — <https://inworld.ai/resources/best-speech-to-speech-apis>
- Realtime TTS API — <https://inworld.ai/tts-api>
- Inworld docs — <https://docs.inworld.ai/tts/tts>
- Pricing — <https://inworld.ai/pricing>
- Artificial Analysis (Inworld family) — <https://artificialanalysis.ai/text-to-speech/model-families/inworld>
