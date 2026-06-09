# Design — Plan 6: Voice-loop legacy parity + per-sentence streaming TTS

**Date:** 2026-05-10
**Status:** Awaiting user review of this spec
**Author:** Bruno + Claude (brainstorming session)
**Parent spec:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`
**Predecessor plan:** `docs/superpowers/plans/2026-05-10-plan-5-around-the-voice.md` (DONE, validated on device)
**Legacy reference:** `my-language-coach/` (Expo SDK 52 RN app — re-read during brainstorming)

---

## Summary

Plan 6 restores the in-session experience Bruno had in the legacy app, plus fixes the latency that made the rebuild feel sluggish. Six legacy parity features anchored on the Practice screen, one inline-error UX upgrade, and one architectural change (per-sentence streaming TTS) that cuts perceived response time roughly in half. After Plan 6, daily practice should feel as good as the legacy app — and noticeably smoother.

The visual identity work (header restoration, intro animation, Lottie avatar elsewhere, app icon, FadeInView, full UI design pass) is intentionally deferred to **Plan 7**. Engagement/monetization (topics, vocab, freemium, push) is **Plan 8** along with the Play Store internal track release before 2026-07-04.

---

## Goals

- **Restore legacy parity in the practice flow:** in-session timer + status banner, per-message repeat, listening-mode toggle, daily-goal reward (confetti + sound), greeting audio cache, client-side silence detection.
- **Replace full-screen red errors with inline coach messages** for non-fatal cases (silent audio, too-short audio, transient provider failures).
- **Halve perceived latency** by streaming coach replies as per-sentence audio chunks. First audio plays in ~2s instead of ~5s, and text + audio arrive in lockstep.

## Non-goals (explicit)

- **Lottie avatar in-session, intro animation, header bar, app icon, FadeInView.** Plan 7.
- **Topics, vocab list, push notifications, freemium paywall body.** Plan 8.
- **Cross-session user-message replay.** v1 only replays user audio within the active session (we have the local file URI in memory). Cross-session replay would require fetching from the `user-audio` Storage bucket — small additional API cost, deferred for YAGNI.
- **Per-token text streaming.** The current `reply-text-delta` event is dropped in favor of per-sentence chunks. The visible "live typing" feel is replaced with sentence-by-sentence appearance, which actually matches audio cadence and reduces UI jank.
- **GPT-generated personalized greetings.** Static templates per language with name interpolation; cached audio. No first-session LLM cost.
- **Full sentence-segmentation NLP.** Simple regex on `.!?` is sufficient for v1. Edge cases like "Mr." or "U.S.A." may produce extra chunks; acceptable cost for simplicity.

---

## 1. Architecture overview

Mostly client-side enhancements to the existing Practice screen + `useConversation` hook. Backend gets:

1. **One new route** — `POST /v1/voice/greeting/audio` returns a signed URL to the cached greeting MP3 (generates + uploads on first miss).
2. **One new route** — `POST /v1/messages/:id/audio` returns a signed URL for replaying a coach message (cached after first generation).
3. **One new column** — `messages.is_greeting boolean default false` (migration `0006`) to flag greeting messages for analytics + future logic.
4. **One major refactor** — the `POST /v1/voice/sessions/:id/turns` SSE handler is rewritten to do parallel per-sentence TTS and emit `reply-chunk` events instead of separate `reply-text-delta` + `reply-audio`.
5. **One new public Storage bucket** — `greeting-audio` (greeting MP3s shared across users in the same lang+name combo, no auth needed for reads).

No data model changes beyond the one column.

---

## 2. Coach greeting (templates + cache)

### Templates

`packages/shared/src/greetings.ts`:

```ts
import type { SupportedLang } from "./languages";

export const GREETING_TEMPLATES: Record<SupportedLang, string> = {
  en: "Hi {name}! What would you like to talk about today?",
  fr: "Salut {name} ! De quoi veux-tu parler aujourd'hui ?",
  de: "Hallo {name}! Worüber möchtest du heute sprechen?",
  it: "Ciao {name}! Di cosa vuoi parlare oggi?",
  es: "¡Hola {name}! ¿De qué quieres hablar hoy?",
  pt: "Olá {name}! Sobre o que queres falar hoje?",
  tr: "Merhaba {name}! Bugün ne hakkında konuşmak istersin?",
  sv: "Hej {name}! Vad vill du prata om idag?",
  da: "Hej {name}! Hvad vil du tale om i dag?",
  ru: "Привет, {name}! О чём хочешь поговорить сегодня?",
  ro: "Bună, {name}! Despre ce vrei să vorbim astăzi?",
  hu: "Szia {name}! Miről szeretnél ma beszélni?",
};

export function buildGreeting(lang: SupportedLang, name: string): string {
  return GREETING_TEMPLATES[lang].replace("{name}", name);
}
```

Pure data + a one-line builder. Easy to unit-test.

### Greeting flow when starting a session

1. Mobile calls `POST /v1/voice/sessions` (existing) → gets `conversation_id`.
2. Mobile builds the greeting text locally with `buildGreeting(targetLang, displayName)`.
3. Mobile inserts the greeting as the first coach message in local state immediately (zero-latency render).
4. In parallel, mobile asks `POST /v1/voice/greeting/audio` for a signed URL to the cached MP3.
   - Backend cache key: `greeting-{lang}-{nameHash}.mp3` in the `greeting-audio` Storage bucket. `nameHash = sha1(name.toLowerCase().trim()).slice(0, 12)` so "Bruno" and "bruno" share a cache.
   - If MP3 exists → return the URL.
   - If not → generate via OpenAI TTS (`nova` voice), upload to Storage, return the URL. ~$0.015 one-time per (lang, nameHash) combo.
5. Mobile plays the audio when it arrives. Since the text is already rendered, audio just plays "on top" of the visible message — feels instant.
6. Greeting message also stored as a `messages` row (role='coach') with `is_greeting=true` so it's in the transcript + share but excluded from any future logic that should ignore canned content.

### Files

- Create: `packages/shared/src/greetings.ts` + `.test.ts`
- Create: `apps/api/src/routes/voice-greeting.ts` + `.test.ts`
- Modify: `apps/api/src/app.ts` to wire the new route under `/v1/voice/greeting/...`
- Migration: `apps/api/src/db/migrations/0006_messages_is_greeting.sql`
- One-shot SQL (run via Supabase Editor, documented in plan): create `greeting-audio` Storage bucket, set public-read RLS policy.

---

## 3. Top status bar (timer + progress + streak + listening)

Replaces the current minimal `topBar` in `apps/mobile/app/(tabs)/practice.tsx`.

### Layout

```
┌────────────────────────────────────────────────────┐
│  ⏱ 6 / 10 min  ·  🔥 12  ·  🎧       ↗  End      │
└────────────────────────────────────────────────────┘
```

- **Left cluster:**
  - **Timer + progress pill:** `⏱ X / Y min today` where X = floor((`secondsAtSessionStart` + `currentSessionSeconds`) / 60), Y = `daily_goal_minutes`. Live-updates every second. When X ≥ Y, switches to `🎯 X min — goal hit` in green.
  - **Streak:** `🔥 N` (small, no "day(s)" suffix to save space). Hidden when N=0.
  - **Listening toggle:** 👁 when off (text visible), 🎧 when on (text hidden). Tap to toggle.
- **Right cluster:**
  - **Share** button (existing — Plan 5)
  - **End** button (existing — Plan 4)

### Styling

Single horizontal bar, ~56px tall, white bg, hairline bottom border. Compact 13-14pt text. Tap targets ≥ 44×44.

### Live timer logic

New hook `apps/mobile/src/features/practice/use-session-timer.ts`:

```ts
export function useSessionTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return { seconds, reset: () => setSeconds(0) };
}
```

Active when `state.phase` is `'recording' || 'processing' || 'idle'` (i.e., the session is alive). Pauses on `'error'` or `'loading-session'`.

### Daily progress integration

- Read today's `seconds_spoken` once on mount via `useTodayStats()` (Plan 5).
- Add the in-session `seconds` on top: `displaySeconds = todayStatsAtSessionStart + sessionSeconds`.
- This is OPTIMISTIC — the backend won't have these seconds until `/end` is called. Gives instant visual feedback.

### Goal-crossed detection

- Compute `crossedGoalThisSession = displaySeconds >= goalSeconds && previousDisplaySeconds < goalSeconds`.
- When true AND `streak_days.goal_reached === false` (today's row), fire the daily-goal reward (Section 5).

### Files

- Create: `apps/mobile/src/features/practice/use-session-timer.ts`
- Create: `apps/mobile/src/features/practice/top-status-bar.tsx`
- Modify: `apps/mobile/app/(tabs)/practice.tsx` — replace topBar with `<TopStatusBar />`, wire the timer hook
- Modify: `apps/mobile/src/features/practice/use-conversation.ts` — extract listening-mode state (Section 4)

---

## 4. Per-message repeat + listening mode

These two are tightly coupled because both modify how `MessageBubble` renders.

### Per-message repeat

**UX:**

- Each coach bubble gets a 🔁 icon (next to the existing 🌐 translate icon).
- Tap → re-plays the coach's audio for that message.
  - If we have an `audioUrl` for the message (from the SSE chunk events), play it directly.
  - If not (e.g., very old message scrolled back to in a long session), call `POST /v1/messages/:id/audio` which returns a signed URL — backend regenerates TTS if needed and caches per `messageId.mp3` in the existing `user-audio` Storage bucket. Free for cached, ~$0.015 to regenerate.
- Each user bubble also gets 🔁 — replays their own recording from the local file URI captured at recording time. Works only within the same session for v1 (in-memory state); cross-session user-replay is deferred.

### Listening mode

**UX:**

- Top status bar's 👁/🎧 toggle is the master switch. Default OFF (text visible).
- When ON: every coach + user message bubble renders as `🎧 0:04` (icon + audio duration in M:SS) instead of text.
- Tap a hidden bubble → plays the audio (same as 🔁) AND reveals that one bubble's text just for that turn (state resets when the toggle goes off+on).
- The translate icon 🌐 is hidden when listening mode is on (no text to translate).

### State

- New piece of conversation state: `listeningMode: boolean`. Lives in `useConversation`.
- Per-message reveal set: `revealedMessageIds: Set<string>`. Reset whenever `listeningMode` changes.
- `MessageBubble` receives `listeningMode` and `revealed` props, switches render branch.

### Audio duration

- Coach: from the SSE `reply-chunk` event's `durationMs` field, summed across chunks for the message. Stored on the message as `audioDurationMs`.
- User: from `expo-audio` recorder's `getStatusAsync()` after stop, stored on the user message.

### Files

- Modify: `apps/mobile/src/features/practice/use-conversation.ts` — listening state, reveal helpers, audio duration tracking
- Modify: `apps/mobile/src/features/practice/types.ts` — add `audioDurationMs?: number` to `ChatMessage`
- Modify: `apps/mobile/src/features/practice/MessageBubble.tsx` — listening-mode render branch + repeat icon
- Backend: extend `apps/api/src/routes/messages.ts` with `POST /:id/audio` endpoint
- Mobile: `apps/mobile/src/features/practice/api-message-audio.ts` (new client function)

---

## 5. Daily-goal reward + inline error coach messages

### Daily-goal reward

**UX:** when `displaySeconds` first crosses `goalSeconds` mid-session AND `streak_days.goal_reached === false`, three things fire in parallel — all non-blocking:

1. **Confetti** — `react-native-confetti-cannon`, 100 particles, ~3 second animation, transparent overlay.
2. **Victory sound** — `apps/mobile/assets/sounds/victory.mp3` (lifted from legacy `my-language-coach/assets/sounds/victory.mp3`), plays once at moderate volume via `expo-audio`.
3. **Toast banner** — non-modal overlay slides in from the top: `🎉 Goal hit! N days in a row 🔥` (uses streak count from query). Auto-dismisses after 3 seconds.

**Crucially:** does NOT interrupt the practice flow. No modal, no tap-to-dismiss. Bruno keeps talking; reward washes over.

### Avoiding double-fire

- A `useRef<boolean>` (`goalRewardFiredRef`) ensures it fires once per mounted Practice screen.
- Backend-side, `streak_days.goal_reached` is set to true on `/end` (Plan 4). On next session same day, the upfront stats fetch returns `goal_reached: true` so the cross-detection short-circuits.

### Files

- New asset: `apps/mobile/assets/sounds/victory.mp3` (~22 KB, lifted from legacy)
- New dep: `react-native-confetti-cannon` (JS-only, no native build) — install via `npx expo install` per Plan 5 lesson
- Create: `apps/mobile/src/features/practice/goal-reward.tsx` — confetti + sound + toast component
- Create: `apps/mobile/src/features/practice/use-goal-reward.ts` — hook that detects the cross + fires
- Modify: `apps/mobile/app/(tabs)/practice.tsx` — render `<GoalReward />` overlay

### Inline error coach messages

Replaces the current full-screen red error UI for _non-fatal_ errors (which are most of them in practice).

**Mapping:**

| Backend error code     | Current UX       | New UX                                                                               |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `AUDIO_SILENT`         | Full-screen red  | Inline coach: `"Hmm, I didn't catch that — could you try again?"` (in target lang)   |
| `AUDIO_TOO_SHORT`      | Full-screen red  | Inline coach: `"That was a bit too short — give it another go!"` (in target lang)    |
| `STT_PROVIDER_FAILURE` | Full-screen red  | Inline coach: `"I'm having trouble hearing — could you repeat?"`                     |
| `LLM_PROVIDER_FAILURE` | Full-screen red  | Inline coach: `"Something on my end glitched — let's keep going."` (with 🔁 enabled) |
| `TTS_PROVIDER_FAILURE` | Full-screen red  | Inline coach: text only with a small 🔇 indicator (no audio playback)                |
| `QUOTA_EXCEEDED`       | (Plan 8 paywall) | Stays full-screen — different category                                               |
| `UNAUTHORIZED`         | Full-screen      | Stays — auth break is fatal, signs user out                                          |
| `INTERNAL`             | Full-screen      | Stays — unknown, fail safe                                                           |

**Implementation:**

- Pre-compute fallback messages per language in `packages/shared/src/coach-fallbacks.ts` (12 langs × 5 fallback strings).
- In `useConversation.stop()`, when an error from the SSE stream maps to a "soft" code, instead of `setState({ phase: 'error', ...})`, push a synthetic coach message with the fallback text and reset to `phase: 'idle'`.
- The state still goes to `error` for fatal codes; the existing "Try again" button (Plan 5 fix) covers retry.

### Files

- Create: `packages/shared/src/coach-fallbacks.ts` + `.test.ts`
- Modify: `apps/mobile/src/features/practice/use-conversation.ts` — error-mapping logic in the stop() catch + done event flow

---

## 6. Client-side silence detection

Invisible to the user — just avoids wasted backend calls.

**Flow:** after the user releases the mic:

1. `expo-audio` recorder produces a file URI.
2. New helper `apps/mobile/src/features/practice/audio-rms.ts` computes peak RMS amplitude.
3. If peak RMS < threshold (~0.02 normalized) → don't send to backend. Push the `AUDIO_SILENT` inline coach message (Section 5) directly. Reset to idle.
4. If peak RMS ≥ threshold → proceed with the normal upload + transcribe flow.

**Defense in depth:** server-side `AUDIO_SILENT` detection stays in place. Client check is an optimization, not a replacement.

**Implementation note:** RN doesn't expose raw PCM samples easily. Primary approach: use `expo-file-system` to read the M4A as bytes + a lightweight in-process decoder. **Fallback:** if decoding M4A in JS proves slow or unreliable, just check duration + file size (`recorder.getStatusAsync()`) and treat "very short or very small file" as likely-silent. Less precise but works without dep additions. Plan task explicitly acknowledges the fallback.

### Files

- Create: `apps/mobile/src/features/practice/audio-rms.ts` + `.test.ts`
- Modify: `apps/mobile/src/features/practice/use-conversation.ts` — RMS check before `streamTurn`

---

## 7. Per-sentence streaming TTS (latency fix)

The big architectural change. Cuts perceived response time roughly in half.

### Problem

Current flow waits for the full GPT response to complete, then runs a single TTS call on the entire reply, then uploads, then plays. End-to-end: ~5s from mic-release to first audio. Users see text appear (via `reply-text-delta`) but hear no audio for 3-4 more seconds — awkward gap.

### New SSE protocol

Replaces today's `reply-text-delta` (per-token) + `reply-audio` (full final audio) with:

| Event           | Payload                                 | When                                            |
| --------------- | --------------------------------------- | ----------------------------------------------- |
| `transcription` | `{ text }`                              | (unchanged) After STT completes                 |
| `reply-chunk`   | `{ index, text, audioUrl, durationMs }` | One per sentence — text + audio arrive together |
| `done`          | `{ messageId }`                         | (unchanged) Final event with server msg id      |
| `error`         | `{ code, message, retryable }`          | (unchanged)                                     |

**Why drop per-token streaming:** since audio is the real experience and text+audio should arrive in lockstep, there's no value in showing text faster than its audio. Per-sentence chunks are a clean unit. Cleaner mobile UI than juggling two parallel streams.

### Backend orchestration

`POST /v1/voice/sessions/:id/turns` flow becomes:

```
1. STT → user transcript → emit `transcription`
2. Quota check → quota update
3. Insert user message (with audio_storage_path)
4. Open GPT stream
5. accumBuffer = ""
   chunkIndex = 0
   activeTtsPromises = []

   for await (delta of gptStream):
     accumBuffer += delta
     if accumBuffer ends with sentence terminator (. ! ?) followed by space|end:
       sentence = accumBuffer
       accumBuffer = ""
       const idx = chunkIndex++
       activeTtsPromises.push(synthesizeAndEmit(sentence, idx))

   // Final flush for any remaining text
   if accumBuffer.trim():
     activeTtsPromises.push(synthesizeAndEmit(accumBuffer, chunkIndex++))

   await Promise.all(activeTtsPromises)

6. Insert coach message (full text), get server msg id
7. emit `done` with messageId

synthesizeAndEmit(text, idx):
   tts → audio buffer → upload to Storage at <userId>/<convId>/<msgId>-<idx>.mp3
   → signed URL → SSE emit `reply-chunk` { index: idx, text, audioUrl, durationMs }
```

**Critical detail:** chunks may finish out of order (sentence 3's TTS could resolve before sentence 2's). The `index` field lets mobile reorder + play in correct sequence.

**Sentence detection:** `splitOnSentenceBoundary(buffer)` is a pure function in `apps/api/src/lib/sentence-buffer.ts`. Simple regex `/[.!?]+\s/` is sufficient for v1. Doesn't handle "Mr." / "U.S.A." perfectly — acceptable cost for simplicity. The function is unit-tested against a fixture of edge cases so we know exactly what produces extra splits.

### Mobile audio queue

New module `apps/mobile/src/features/practice/audio-queue.ts`:

```ts
type Chunk = { index: number; audioUrl: string; durationMs: number; text: string };

export class AudioQueue {
  private chunks = new Map<number, Chunk>();
  private nextToPlay = 0;
  private currentSound: AudioPlayer | null = null;

  enqueue(chunk: Chunk): void {
    this.chunks.set(chunk.index, chunk);
    if (chunk.index === this.nextToPlay && !this.currentSound) {
      void this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    const chunk = this.chunks.get(this.nextToPlay);
    if (!chunk) return; // wait for it to arrive
    this.currentSound = createAudioPlayer({ uri: chunk.audioUrl });
    this.currentSound.play();
    await waitForEnd(this.currentSound);
    this.nextToPlay++;
    void this.playNext();
  }

  isPlaying(): boolean { ... }
  reset(): void { ... }
}
```

`useConversation.stop()` creates a fresh queue per turn. As `reply-chunk` events arrive from SSE, push into queue. The queue handles ordering + sequential playback. Mic re-enables when queue is empty AND `done` event received.

### Mobile UI per chunk

Coach message bubble rendering changes:

- Display all received chunks' text **in order** as they arrive (sentences appear one by one).
- Audio plays the corresponding sentence in lockstep.
- Result: text appears at the moment its audio starts playing. No gap.

`MessageBubble` for in-flight coach messages renders the concatenated text from all chunks received so far. Final text (in `messages.text` server-side) is the concatenation of all chunks.

### Greeting interaction

The greeting (Section 2) is its own pre-baked single audio, NOT chunked. It doesn't go through the queue. Plays immediately on session start. The chunked flow only applies to coach replies during turns.

### Cost note

Per-sentence TTS = more API calls but each is shorter. Net cost is roughly the same (~5-15% overhead from per-call billing). Negligible at MVP scale.

---

## 8. Backend changes summary

| Change                                                                | File                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `POST /v1/voice/greeting/audio`                                       | `apps/api/src/routes/voice-greeting.ts` (new)                    |
| `POST /v1/messages/:id/audio`                                         | extend `apps/api/src/routes/messages.ts`                         |
| Migration: `messages.is_greeting boolean default false`               | `apps/api/src/db/migrations/0006_messages_is_greeting.sql`       |
| `greeting-audio` public Storage bucket + RLS policy                   | one-shot SQL applied via Supabase Editor (documented in plan)    |
| Sentence-splitter pure function                                       | `apps/api/src/lib/sentence-buffer.ts` (new)                      |
| Voice-turn route refactor: per-sentence orchestration + new SSE event | `apps/api/src/routes/voice.ts` (or `voice-turn.ts` if extracted) |
| Storage helper for chunked uploads                                    | `apps/api/src/lib/storage.ts` — add `uploadCoachAudioChunk`      |

---

## 9. Mobile files summary

**New:**

- `apps/mobile/src/features/practice/use-session-timer.ts`
- `apps/mobile/src/features/practice/use-goal-reward.ts`
- `apps/mobile/src/features/practice/top-status-bar.tsx`
- `apps/mobile/src/features/practice/goal-reward.tsx`
- `apps/mobile/src/features/practice/audio-queue.ts`
- `apps/mobile/src/features/practice/audio-rms.ts`
- `apps/mobile/src/features/practice/api-greeting.ts`
- `apps/mobile/src/features/practice/api-message-audio.ts`

**Modified:**

- `apps/mobile/src/features/practice/use-conversation.ts` — biggest changes (greeting flow, listening mode, error mapping, RMS check, audio queue + chunk handling, audio durations)
- `apps/mobile/src/features/practice/MessageBubble.tsx` — listening view, repeat icon
- `apps/mobile/src/features/practice/types.ts` — add `audioDurationMs`, `isGreeting`
- `apps/mobile/src/lib/api-client.ts` — `TurnEvent` type updates (drop `reply-text-delta` + `reply-audio`, add `reply-chunk`)
- `apps/mobile/app/(tabs)/practice.tsx` — replace topBar with `TopStatusBar`, render `GoalReward` overlay

**New asset:**

- `apps/mobile/assets/sounds/victory.mp3` (lifted from legacy)

**New dep:**

- `react-native-confetti-cannon` — install via `npx expo install` (NOT `pnpm add`, per Plan 5 lesson)

**New shared package modules:**

- `packages/shared/src/greetings.ts`
- `packages/shared/src/coach-fallbacks.ts`

---

## 10. Testing strategy

- **Pure unit tests** (Vitest, no RNTL — same constraint as Plan 5):
  - `greetings.test.ts` — `buildGreeting` fills name correctly; all 12 langs covered.
  - `coach-fallbacks.test.ts` — all 12 langs × 5 codes covered, no empty strings.
  - `sentence-buffer.test.ts` — splits on `.!?` followed by space; covers fixture with edge cases (multi-punctuation, abbreviations, no terminator at all).
  - `audio-rms.test.ts` — synthetic silent buffer → false; synthetic loud buffer → true. (If using duration+size fallback, test that path instead.)
  - `audio-queue.test.ts` — enqueue out of order → plays in index order; reset clears state.
- **API route tests** (Vitest with mocked deps):
  - `voice-greeting.test.ts` — cache hit returns existing URL; cache miss generates + uploads + returns; auth required.
  - `messages.test.ts` — extend with audio endpoint tests (cache hit, regenerate, ownership 404).
  - `voice.test.ts` — extend with chunked-emission test (single sentence → one chunk; multi-sentence → multiple chunks in order).
- **No UI render tests** for the same RNTL+Vitest reason as Plan 5.
- **Manual on-device validation** (final task): exercise every Plan 6 surface — greeting plays on session start, timer ticks live, listening mode hides + reveals, repeat replays, silent audio caught client-side, soft errors render inline, goal-reward fires once per day with confetti+sound, per-sentence streaming makes first audio arrive in ~2s.

---

## 11. Done criteria

- All Plan 6 features land in commits on `main`.
- CI + Deploy green.
- Bruno's on-device validation passes the manual checklist.
- Greeting plays in <500ms after session start when cached, <3s on first launch in a language.
- First audio chunk plays in ~2s after mic release (vs ~5s in Plan 5).
- No regressions to Plan 5 features (translation, share, profile editing, home, progress).

---

## 12. Open questions / future work

- **Lottie avatar in-session.** Plan 7 — visual identity work.
- **Cross-session user-message replay.** Defer until users actually request it.
- **Smarter sentence segmentation** (e.g., handling "Mr." or "U.S.A."). Acceptable v1 trade-off.
- **Personalized greetings** ("Last time we talked about..."). Defer to a "AI personalization" mini-plan after release.
- **Quota gating for greeting audio.** Currently free; monitor cost. If users abuse re-greetings (e.g., repeatedly changing display name to bust the cache), gate it.

---

## References

- Parent spec: `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`
- Plan 5 (predecessor): `docs/superpowers/plans/2026-05-10-plan-5-around-the-voice.md`
- Legacy app reference: `my-language-coach/` (specifically `components/ChatScreen.js`, `hooks/useConversationTimer.js`, `components/TopBanner.js`, `components/ChatList.js`, `utils/cache.js`)
- Memory note: `~/.claude/projects/.../memory/project_legacy_features_to_port.md`
