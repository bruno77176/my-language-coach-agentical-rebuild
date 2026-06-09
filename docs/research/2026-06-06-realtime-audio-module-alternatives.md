# Realtime audio capture — `expo-stream-audio` and its alternatives

**Date:** 2026-06-06
**Context:** During the `fix/voice-live-playandrecord` work we found that `expo-stream-audio@0.1.3`
hardcodes an invalid iOS audio-session category (`.record` + `.voiceChat` → OSStatus -50). That
forced a `pnpm patch`. Bruno asked: why did we build on something this immature, and what are the
alternatives?

---

## 1. Why this fragile module got picked (the honest answer)

The app targets **Expo SDK 54 / RN 0.81**. The requirement for the voice loop is unusual: stream
**raw PCM 16-bit mono frames to JS in real time** (for live STT / the Horizon-2 realtime path),
**not** record to a file and upload it.

That narrows the field hard:

- The **official `expo-audio`** in SDK 54 only does **file-based recording** (`useAudioRecorder`).
  Real-time PCM streaming (`useAudioStream` / `onBuffer`) was **added later — it is NOT in SDK 54**
  (confirmed against the SDK 54 docs; it appears in the "latest"/SDK 55 docs only).
- Most other RN audio libraries also record to a file. Very few expose **live raw PCM frames**.
- `expo-stream-audio` does **exactly** that, and is built **specifically for SDK 54 / RN 0.81**.

So it matched the exact niche on the exact SDK — which is precisely how a 2-week-old, one-author,
12-star experimental project ends up in the critical path. It was the easiest thing that fit, not the
most robust. That's the trap, and it's worth correcting now that the app works.

### `expo-stream-audio` maturity snapshot

| Metric                      | Value                                              |
| --------------------------- | -------------------------------------------------- |
| Created                     | 2025-11-28                                         |
| Last push                   | 2025-12-09 (~2 weeks of activity, then dormant)    |
| Total commits               | 6                                                  |
| Stars / forks / subscribers | 12 / 2 / 0                                         |
| Maintainers                 | 1 (vLaD1m1r99)                                     |
| Status                      | "experimental", no formal release                  |
| Origin                      | "internal tool for testing realtime STT pipelines" |

The `-50` bug survived because (a) the invalid category sometimes "passes" on the author's
device/iOS version, and (b) the author only ever exercised mic-only transcription, never simultaneous
playback. The crash is unambiguously a **library bug**, not misuse — the failing line is hardcoded and
not configurable from JS.

---

## 2. Alternatives (cascade STT→LLM→TTS architecture — like-for-like)

These keep the current architecture (capture PCM → send to STT → GPT → TTS). Ordered by fit + maturity.

### ⭐ Recommended near-term replacement — `@siteed/expo-audio-studio` (repo: `deeeed/audiolab`)

| Metric                      | Value                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Created                     | 2024-04-20                                                                                      |
| Last push                   | **2026-06-03 (actively maintained)**                                                            |
| Stars / forks / open issues | **312 / 54 / 7**                                                                                |
| Scope                       | "Cross-platform audio SDK — streaming, recording, analysis, visualization, on-device inference" |
| Platforms                   | iOS, Android, **Web**                                                                           |
| Expo                        | Config plugin, works on SDK 54                                                                  |

The clear maturity leader. Does exactly what we need (real-time PCM stream callback) plus a lot more,
is actively maintained by a real maintainer, and has 25× the adoption. **This is the recommended swap
to de-risk the dependency** without an architecture change.

### `mykin-ai/expo-audio-stream`

| Metric                      | Value                                                        |
| --------------------------- | ------------------------------------------------------------ |
| Created                     | 2024-04-18                                                   |
| Last push                   | 2025-12-16                                                   |
| Stars / forks / open issues | 57 / 17 / 9                                                  |
| Scope                       | Record + stream mic audio AND play audio chunks in real time |

Decent second choice; records and plays realtime chunks (closer to our full loop). Less active than
`@siteed`, but far more mature than `expo-stream-audio`.

### `mybigday/react-native-audio-pcm-stream` — ❌ not recommended

Bare RN (no Expo config plugin), fork of the old `react-native-live-audio-stream`, last pushed
**2023-03-24** (effectively dead), 17 stars. Same fragility risk as today, with less momentum.

### `react-native-live-audio-stream` (xiqi) — ❌ not recommended

The original classic. Bare RN, unmaintained for years. Only worth knowing as the ancestor of the two
above.

---

## 3. The "do it the official way" path — `expo-audio` `useAudioStream` (requires SDK 55)

The official `expo-audio` now exposes real-time PCM via the `AudioStream` class / `useAudioStream()`
hook, delivering `int16` or `float32` frames through an `onBuffer` callback. **This would let us drop
the third-party module entirely** — the cleanest long-term answer.

Catch: it is **not in SDK 54**. Adopting it means an SDK 55 upgrade, which is a separate, larger piece
of work. Worth scheduling, not a quick swap.

---

## 4. The architecture-change path — WebRTC speech-to-speech (Horizon 2)

This is a different design, not a module swap: instead of cascade STT→GPT→TTS, stream audio over
**WebRTC** to a realtime model. In 2026 this is the production standard for natural voice agents
(sub-100ms latency). Matches the **Horizon 2 realtime** goal already noted in
`project_latency_optimization`.

- **LiveKit Agents** — open-source, self-hostable, plugins for OpenAI Realtime, Deepgram, Cartesia,
  Silero. The de-facto standard; OpenAI partnered with them for Advanced Voice.
- **OpenAI Realtime API (WebRTC)** — speech-to-speech directly.
- **Stream / Daily** — managed edge networks that keep OpenAI creds server-side, with RN SDKs.

Bigger lift (new transport, new billing model, server changes) but it's the endgame for latency. Tie
this to the latency-optimization plan rather than treating it as a dependency fix.

---

## 5. Recommendation

1. **Now:** keep the patched `expo-stream-audio` — it works and is pinned. Don't churn mid-release.
2. **Next hardening pass:** migrate to **`@siteed/expo-audio-studio`** (active, 312★, SDK-54-compatible,
   same architecture). Removes the single-author/dormant-dependency risk. Low-to-medium effort.
3. **When upgrading to SDK 55:** drop third-party audio entirely, use official `expo-audio`
   `useAudioStream`.
4. **Horizon 2 (latency plan):** evaluate WebRTC speech-to-speech (LiveKit + OpenAI Realtime). Separate
   architecture decision, not a dependency fix.

Consistent with `project_model_benchmarking` ("never marry one provider/brick") and
`project_latency_optimization` (Horizon 2 realtime).

---

## Sources

- expo-stream-audio: https://github.com/vLaD1m1r99/expo-stream-audio
- @siteed/expo-audio-studio (audiolab): https://github.com/deeeed/expo-audio-stream
- mykin-ai/expo-audio-stream: https://github.com/mykin-ai/expo-audio-stream
- react-native-audio-pcm-stream: https://github.com/mybigday/react-native-audio-pcm-stream
- expo-audio (latest, useAudioStream): https://docs.expo.dev/versions/latest/sdk/audio/
- expo-audio (SDK 54, no useAudioStream): https://docs.expo.dev/versions/v54.0.0/sdk/audio/
- LiveKit Agents: https://github.com/livekit/agents
- OpenAI Realtime (WebRTC): https://developers.openai.com/api/docs/guides/realtime-webrtc
