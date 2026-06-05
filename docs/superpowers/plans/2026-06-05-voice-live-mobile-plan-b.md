# Live Voice Mode — Plan B: Mobile Native Capture + Toggle + Live Hook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the **Live** voice mode to the mobile app — stream mic PCM to the `/v1/voice/live` backend, play the coach audio back continuously, behind a voice-mode toggle gated to entitled users — so Bruno can hold a hands-free, always-listening conversation on his device.

**Architecture:** A native PCM capture module (`expo-stream-audio`) feeds 16 kHz mono base64 frames to a `use-live-conversation` hook, which streams them over a WebSocket to `/v1/voice/live` and plays the returned `reply-chunk` audio (reusing the existing inline-audio playback). The existing push-to-talk `use-conversation` hook is untouched; the Practice screen picks the hook by the active voice mode. Barge-in + mute + echo tuning are **Plan C** (this plan lands the basic Live loop first).

**Tech Stack:** Expo SDK 54, React Native 0.81, `expo-stream-audio`, a browser/RN `WebSocket`, expo-file-system (audio cache), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-live-voice-mode-streaming-stt-design.md`
**Backend (Plan A, merged):** `/v1/voice/live` — query-token auth (`?token=&conversation_id=`), inbound binary PCM frames, inbound `{type:"cancel"}`, outbound JSON `{type:"user-transcript"|"reply-chunk"|"turn-done"|"error"}` where `reply-chunk` = `{index,text,audioBase64,contentType}`.

---

## Native module decision (resolved 2026-06-05)

**`expo-stream-audio`** — tested on Expo SDK 54 / RN 0.81; outputs PCM16 mono (default 16 kHz, matching the backend's `linear16`/`sample_rate:16000`); API: `start(opts)`, `stop()`, `getStatus()`, `addFrameListener(cb)` → `{pcmBase64, sampleRate, level, timestamp}`, `addErrorListener(cb)`.

- **Mute** = stop forwarding frames in JS (no native API needed).
- **Barge-in VAD** = threshold on the frame `level` meter (Plan C).
- **Echo-cancellation caveat:** Android uses `VOICE_COMMUNICATION` source; iOS has no documented voice-processing mode. Ship with **headphones recommended**; if iOS speaker barge-in is bad in Plan C, fork in iOS `AVAudioEngine` voice-processing or switch to a custom config-plugin module.
- Adding it requires a **fresh EAS dev build** (native module) — Tasks that need it are marked **[device build]**.

---

## File Structure

- Create `apps/mobile/src/lib/live-socket.ts` — typed WebSocket client for `/v1/voice/live` (pure TS, unit-testable with a mock socket).
- Create `apps/mobile/src/lib/live-socket.test.ts`.
- Create `apps/mobile/src/features/practice/use-live-conversation.ts` — the Live hook (state machine + frame→socket + playback).
- Create `apps/mobile/src/features/practice/use-live-conversation.test.ts` — state-machine logic tests.
- Create `apps/mobile/src/features/practice/voice-mode.ts` — `VoiceMode` type + persisted setting helpers.
- Modify `apps/mobile/src/lib/api-client.ts` — add `getAllowedVoiceModes()` (reads from the profile/me response).
- Modify the Practice screen (`apps/mobile/app/(tabs)/practice.tsx` — confirm exact path) — voice-mode switcher (shown only when >1 mode allowed) + pick the hook by mode.
- Backend (small): expose allowed voice modes on the profile/me response so the client knows whether to show the toggle (mirrors `VOICE_LIVE_USER_IDS`).

---

## Task 1: Backend — expose allowed voice modes

So the client knows whether to show the Live/S2S toggle without hardcoding the allowlist.

- [ ] Add `voiceModes: string[]` (e.g. `["push_to_talk"]` or `["push_to_talk","live"]`) to the `GET /v1/profile` (or `/me`) response, computed from `canUseLiveVoice(userId, parseLiveVoiceIds(env.VOICE_LIVE_USER_IDS))`. TDD in the API package. Commit.

## Task 2: `live-socket.ts` — the WS client (pure TS, TDD)

A thin wrapper over `WebSocket` exposing: `connect()`, `sendAudio(base64)`, `cancel()`, `close()`, and callbacks `onUserTranscript`, `onReplyChunk`, `onTurnDone`, `onError`, `onClose`. Injects a `WebSocket` factory for tests.

- [ ] **Step 1 (RED):** test that inbound `reply-chunk` JSON invokes `onReplyChunk` with `{index,text,audioBase64,contentType}`; `sendAudio(base64)` sends the decoded bytes as a binary frame; `cancel()` sends `{"type":"cancel"}`. Use a fake WebSocket.
- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3 (GREEN):** implement. URL: `${WS_BASE}/v1/voice/live?token=${jwt}&conversation_id=${id}`. Decode base64 PCM → `ArrayBuffer` → `ws.send(buffer)`. Parse inbound JSON by `type`.
- [ ] **Step 4:** run → PASS. **Step 5:** commit.

## Task 3: `voice-mode.ts` — setting + type

- [ ] `export type VoiceMode = "push_to_talk" | "live" | "speech_to_speech";` + `getVoiceMode()/setVoiceMode()` persisted via the app's storage (match existing settings pattern). Default `push_to_talk`. TDD the persistence helpers. Commit.

## Task 4: `use-live-conversation.ts` — the Live hook [device build]

State machine `idle → listening → userSpeaking → thinking → coachSpeaking → listening`. On start: open `live-socket`, `expo-stream-audio.start({sampleRate:16000})`, forward each `frame.pcmBase64` via `socket.sendAudio`. On `reply-chunk`: write base64 to a cache file (same pattern as `use-conversation.ts` inline-audio at `use-conversation.ts:272`) and enqueue playback. On `user-transcript`/`turn-done`: drive UI state. Mute = a ref that gates frame forwarding.

- [ ] **Step 1 (RED):** unit-test the **pure state-machine reducer** (transitions on socket events + start/stop/mute) in isolation — no native module, no real socket. Per the project's Vitest+RN limit, do NOT render components.
- [ ] **Step 2:** FAIL. **Step 3 (GREEN):** implement the reducer + a thin hook wrapper wiring `expo-stream-audio` + `live-socket` + playback. **Step 4:** PASS. **Step 5:** commit.

## Task 5: Install `expo-stream-audio` + Practice wiring [device build]

- [ ] `npx expo install expo-stream-audio` (then `pnpm install` per [pnpm native-symlinks rule]); `npx expo-doctor`.
- [ ] In the Practice screen: add the voice-mode switcher (visible only when `allowedVoiceModes.length > 1`); when mode is `live`, render the `use-live-conversation` flow instead of push-to-talk. Push-to-talk path unchanged.
- [ ] Bump `app.config.ts` versionCode/buildNumber. `eas build --profile development --platform android` → install on device.
- [ ] **Device smoke test:** switch to Live, hold a conversation — confirm transcript appears, coach speaks back, audio plays continuously. (Barge-in/mute/echo = Plan C.)
- [ ] Commit.

## Done-criteria for Plan B

- Mobile + API suites green; typecheck + lint clean.
- On Bruno's device: Live mode is selectable (his account), and a basic always-listening conversation works end-to-end (mic → transcript → coach audio).
- Plan C follows: barge-in (level-meter VAD + `cancel`), mute button, echo tuning.

## Open items

- Confirm exact Practice screen path + existing settings/storage helper before Tasks 3/5.
- `WS_BASE`: `wss://my-language-coach-agentical-rebuild.fly.dev` (derive from the existing API base URL).
- Echo cancellation on iOS speaker — revisit in Plan C if barge-in misfires.
