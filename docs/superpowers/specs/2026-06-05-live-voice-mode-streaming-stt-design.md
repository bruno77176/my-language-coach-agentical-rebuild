# Live Voice Mode (Streaming STT + Barge-in) — Design

- **Date:** 2026-06-05
- **Status:** Approved (design); ready for implementation planning
- **Author:** Bruno + Claude
- **Related:** `2026-06-04-conversation-latency-analysis.md`, Horizon-2 of the latency plan

## 1. Motivation

The conversation loop today is a **turn-based, push-to-talk cascade**: you hold/tap to record, the whole audio clip is uploaded, transcribed in **batch** (Deepgram), sent to GPT-4o, then spoken back via TTS (now ElevenLabs Flash). After the Horizon-1 latency work (inline audio, local JWT, bigger machine, ElevenLabs default) the remaining big _felt_ win is removing the **post-speech transcription wait** and making the conversation feel continuous and interruptible — i.e. **streaming STT + barge-in**.

This is also the first concrete step of a tiered product model: the voice **mode** is a preview of the subscription **tier**.

| Mode                 | Description                                               | Tier                      |
| -------------------- | --------------------------------------------------------- | ------------------------- |
| **Push-to-talk**     | Today's batch cascade, unchanged                          | Free / default (everyone) |
| **Live**             | Always-listening streaming cascade + barge-in (this spec) | Pro                       |
| **Speech-to-speech** | Realtime S2S model (future, separate spec)                | Max                       |

## 2. Goals / Non-goals

**Goals**

- Add a **Live** voice mode: always-listening, streaming STT, natural end-of-turn detection, barge-in, with a mute control.
- Introduce a **voice-mode toggle** gated by a server-side **entitlement** (allowlist → Bruno's account for now; subscription tier later).
- Keep the existing push-to-talk loop **100% unchanged and always available** to all users, and as the automatic fallback when Live fails.
- Keep our proven multilingual **Deepgram** STT and the existing **LLM → per-sentence TTS** cascade.

**Non-goals (explicitly out of scope here)**

- Speech-to-speech / realtime S2S (separate later spec; the toggle reserves a slot for it).
- Subscription/billing wiring (entitlement is an allowlist for now).
- Replacing or modifying the push-to-talk experience.
- Per-language native default voices (tracked separately).

## 3. The three-mode model & gating

- **Voice mode** is a per-user setting persisted on the profile, defaulting to `push_to_talk`.
- A server-side **entitlement** determines which modes a user may select. Implementation for now: an **allowlist of user IDs** (Bruno's), surfaced to the client so the UI knows what to show. Later this is driven by subscription tier (Pro → Live, Max → S2S) with no client change.
- The mobile **mode switcher** UI appears only when the user is entitled to more than one mode. Non-entitled users never see it and are pinned to push-to-talk.
- Advanced modes must be revocable instantly client-side: if the user (Bruno) flips back to push-to-talk mid-session, the app tears down the Live session and resumes the proven loop.

## 4. Architecture

Keep the new, riskier path **isolated** from the proven one.

**Mobile**

- `use-conversation.ts` (push-to-talk) — **untouched**. This is the guarantee that the default experience cannot regress.
- `use-live-conversation.ts` — **new sibling hook** owning the Live WebSocket, the state machine, barge-in, mute, and playback. The Practice screen selects the hook based on the active voice mode.
- **Native PCM audio module** — a config-plugin native module (or vetted third-party PCM-streaming lib) that captures raw 16 kHz mono PCM using the OS voice-communication mic source (which enables hardware echo-cancellation) and emits base64 frames to JS. Interface: `start()`, `stop()`, `onFrame(base64)`, `setMuted(boolean)`. (`expo-audio` only records to a file and cannot stream live frames — this module is the reason Live needs a fresh native build.)
- **Client VAD** — lightweight local speech-onset detector used **only** to trigger barge-in fast (Deepgram endpointing handles end-of-turn server-side but is too slow to _start_ an interrupt).
- **Voice-mode switcher** UI (entitled accounts only).

**Backend**

- New **`/v1/voice/live` WebSocket route** — authenticates (local JWT), checks entitlement + quota, opens a **Deepgram streaming** connection, bridges audio → transcript, and runs the existing turn pipeline (GPT-4o → per-sentence ElevenLabs TTS), streaming reply-chunks back over the same socket. Reuses the existing turn logic from `voice.ts` where possible.
- New **Deepgram streaming client** (today's `deepgram.ts` is batch-only).
- **Entitlement helper** for advanced voice modes (allowlist via env/config, same spirit as `ADMIN_USER_IDS`).
- The existing turn HTTP endpoint stays untouched.

## 5. Live data flow

1. User starts Live → app opens authenticated WS to `/v1/voice/live`; native module begins capturing PCM.
2. PCM frames stream to the backend, which relays to Deepgram streaming. Deepgram returns interim transcripts + **endpointing** (utterance-end).
3. On utterance-end → final transcript enters the existing cascade (GPT-4o streaming → per-sentence ElevenLabs Flash TTS). Audio chunks stream back over the same WS; the app plays them (reusing inline-audio playback).
4. Loop continues with no buttons — the user just talks.

## 6. State machine (Live hook)

```
Idle → Listening → UserSpeaking → Thinking → CoachSpeaking → Listening …
                       ▲                          │
                       └────── barge-in ──────────┘
```

- **Barge-in:** while in `CoachSpeaking`, the mic stays live. The client VAD detecting speech onset triggers: (a) stop local playback immediately, (b) send a `cancel` control message; the backend **aborts the in-flight LLM/TTS** for that turn; the new utterance becomes the next turn.
- **Mute:** an orthogonal flag. When muted the native module **stops sending** PCM (WS stays open) so room speech is neither transcribed nor able to trigger barge-in. Clear on-screen muted/live indicator. Tap to resume.

## 7. Echo cancellation

Per the agreed "C" target (must work on speaker _and_ headphones):

- **iOS:** `AVAudioSession` voice-processing mode (voiceChat / measurement) so the input path cancels the output (coach) signal.
- **Android:** `AudioSource.VOICE_COMMUNICATION` + `AcousticEchoCanceler`.
- Barge-in sensitivity is gated so residual echo bleed on the speaker does not trip a false interrupt.
- Headphones give a perfect echo path; speaker is good with occasional misfire (accepted trade-off). The app **recommends** headphones for Live but does not require them.

## 8. Error handling & fallback

Live must never strand the user; push-to-talk is always the safety net.

- Native mic stream fails to start, or WS cannot connect → **auto-fallback to push-to-talk** with a quiet notice.
- WS drops mid-session → reconnect with backoff; if unrecoverable, fall back to push-to-talk.
- Deepgram streaming error → end the Live turn cleanly with a soft in-chat message (same UX as today's `STT_FAIL`), not a crash.
- Quota exhaustion → the existing daily voice-budget gate applies (Live counts against the same budget).

## 9. Cost

Deepgram **streaming** bills per minute the connection is open — the entire Live session, including silences and while the coach speaks — versus batch, which bills only spoken audio. Live is therefore materially more expensive per session than push-to-talk. This is intentional and reinforces **Live = Pro tier**. Exact rate-card numbers to be added to the usage/cost tables during implementation (a `deepgram:streaming` rate card is required, analogous to the existing batch card).

## 10. Testing

- **Backend (TDD):** unit-test the `/v1/voice/live` relay with a mock Deepgram stream + mock LLM/TTS — entitlement gating, quota enforcement, utterance-end → turn, and especially **barge-in cancel aborts the in-flight turn**. Runs in CI, no device.
- **Mobile:** unit-test the Live hook's **state-machine logic** in isolation (pure transitions incl. barge-in and mute). Per the project's known Vitest+RN limitation, do not attempt RN component render tests.
- **On-device:** the native module + real audio + echo cancellation can only be validated on Bruno's device via a fresh EAS build. Expected, given the native module.

## 11. Phased rollout (each step shippable)

1. **Backend Live WS + Deepgram streaming relay** — fully testable in CI with a script; no app change yet.
2. **Voice-mode toggle + entitlement (you-only) + mobile native capture module + Live hook** — first device build; basic talk → respond works in Live.
3. **Barge-in + mute + echo tuning** — on-device polish pass; the trickiest part lands last so the basic Live loop is solid first.

## 12. Open questions / research for the implementation plan

- **Native module choice:** vetted third-party PCM-streaming lib (e.g. `react-native-live-audio-stream`) vs. a small custom Expo config-plugin module. Confirm maintenance, Expo SDK 54 compatibility, and that it exposes the voice-communication source + AEC on both platforms.
- **Client VAD:** energy-threshold heuristic vs. a small on-device VAD (e.g. Silero/WebRTC VAD binding) for barge-in onset detection — latency vs. false-trigger trade-off.
- **Deepgram streaming params:** model (nova-3 with the nova-2 carve-out for Chinese — see existing rate-card notes), endpointing/utterance-end thresholds, interim-results on/off, per-language config.
- **WS transport on mobile:** confirm the SSE-over-POST adapter is replaced by a true bidirectional WS client for this route.
- **Reply audio over WS:** reuse the inline-audio base64 chunk format from the existing `reply-chunk` path.
