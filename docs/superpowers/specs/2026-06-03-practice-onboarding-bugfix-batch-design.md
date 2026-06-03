# Practice & Onboarding Bug-Fix Batch — Design

**Date:** 2026-06-03
**Branch:** `fix/practice-onboarding-batch`
**Status:** Approved (design)

A batch of seven user-reported bugs/polish items across the practice (voice-loop)
screen, the coach-voice settings, the paywall modal, and the sign-in screen.

---

## 1. Stop all audio immediately on navigation

**Symptom:** Audio keeps playing after the user navigates away from Practice —
looks buggy.

**Root cause:** `stopActivePlayer()` (in
`apps/mobile/src/features/practice/audio-controller.ts`) only stops the single
current `AudioPlayer`. The `AudioQueue` (`audio-queue.ts`) keeps draining its
remaining chunks, and an in-flight SSE stream keeps enqueuing new ones, so the
next chunk starts playing right after the current one is stopped.

**Fix:**

- Add a module-level **playback generation counter** in `audio-controller.ts`.
- New exported `stopAllPlayback()` increments the counter and calls the existing
  `safeStop` on the current player.
- `playOnce()` captures the counter value on entry; if it has changed by the
  time it would create/start a player, it becomes a no-op and resolves
  immediately. This neutralizes both already-queued chunks and chunks enqueued
  after the stop.
- Replace the `stopActivePlayer()` call in `app/(tabs)/practice.tsx`'s
  `useFocusEffect` cleanup with `stopAllPlayback()`. This fires on tab switch and
  when a modal is pushed over Practice.
- **Verify on device** that pushing the paywall modal over Practice blurs the
  tab (triggering the cleanup). If it does not, add an explicit `stopAllPlayback()`
  at the navigation call sites that push modals from Practice.

## 2. Greeting voice ≠ conversation voice + explicit Save button

**Symptom:** The greeting message is spoken in a different voice than the rest of
the conversation. Changing the coach voice has no effect on the greeting.

**Root cause:** `fetchGreetingAudio` (`api-greeting.ts`) sends only `{ lang, name }`.
The `/v1/voice/greeting/audio` route (`apps/api/src/routes/voice-greeting.ts`)
synthesizes with the **server default** voice and caches by `(lang, nameHash)`
with **no voice component**. So the greeting is always the default voice
regardless of the user's selection.

**Fix (two parts):**

_Voice-aware greeting:_

- `fetchGreetingAudio` sends the current `TtsConfig` from the voice store.
- The greeting route accepts an optional `config`, synthesizes with it, and adds
  a short **voice hash** (sha1 of `provider|voiceId|style|speed`, truncated) to
  the cache key / storage filename, so each voice gets its own cached greeting.
  Old nova-keyed files become unused (harmless).

_Save button on the coach-voice screen_ (`app/(tabs)/profile/voice-lab.tsx`):

- Introduce a local **draft** `TtsConfig` (seeded from the store). Chips update
  the draft only.
- Add a **Save** button, disabled until the draft differs from the persisted
  config. On Save, commit the draft to the Zustand store (`setConfig`).
- Preview uses the draft. "Reset to default" stays (resets draft to
  `DEFAULT_TTS_CONFIG`).
- No persistent on-device greeting cache exists to purge — server-side voice
  keying + committing the new config is sufficient for the next greeting/turn to
  use the chosen voice.

## 3. Scenario opener: remove "Talk first", instant saved opening line

**Symptom:** In scenario role-plays the persona is supposed to speak first, but
the empty state still says _"You make the first move — walk in and speak"_, and
the opener is generated live (slow).

**Root cause:** The `/sessions/:id/opening` route (`apps/api/src/routes/voice.ts`)
generates the opener with `gpt-4o-mini` from a system-only prompt. The Practice
empty state (`app/(tabs)/practice.tsx`) shows scenario copy that contradicts the
persona-speaks-first design.

**Fix:**

- Add **`openingLines: Record<SupportedLang, string>`** to each scenario in
  `packages/shared/src/role-play-scenarios.ts` — the persona's first line in each
  of the 15 supported languages. Generated once via a committed script
  (sibling to `generate-greeting-audios.ts`); EN/FR hand-checked (visible UI
  languages).
- Backend `/opening`: **skip the LLM**. Look up the saved opener for
  `(scenarioId, conversation.language)`, persist it as the coach message,
  synthesize its TTS, and stream the audio through the existing reply-chunk
  pipeline. Keeps the DB row, message id, and translate/share working; drops
  generation latency.
- Client (`use-conversation.ts`): on scenario start, set the coach message
  **text instantly** from the shared `openingLines` map. Audio arrives ~1-2s
  later via the stream; reconcile the server message id on `done`.
- Remove the misleading scenario empty-state sentence in `practice.tsx`.

## 4. Auto-scroll keeps the latest message visible above the mic bar

**Symptom:** Users have to scroll manually when a new message arrives.

**Root cause:** Auto-scroll only fires on `messages.length` change. A streaming
coach reply grows the same bubble (length unchanged), so it drifts below the mic
bar.

**Fix:** Drive auto-scroll from the FlatList's **`onContentSizeChange`** →
`scrollToEnd({ animated: true })`, tracking every content growth including
streaming. Keep generous `contentContainerStyle` `paddingBottom` so the newest
bubble always clears the mic bar. (Standard chat behavior — "keep latest fully
visible above the mic bar", not literal vertical centering.)

## 5. Login keyboard hides the email/password fields

**Symptom:** On sign-in, the keyboard covers the input fields.

**Root cause:** `app/(auth)/sign-in.tsx` is a bare vertically-centered `View`
with no keyboard handling.

**Fix:** Wrap the form in `KeyboardAvoidingView` (`behavior="padding"` on iOS) +
a `ScrollView` with `keyboardShouldPersistTaps="handled"`. Apply the same wrapper
to the other input auth screens (`forgot-password`, `reset-password`,
`change-email`) for consistency — same low-risk pattern.

## 6a. "Google Play" text on the Apple build

**Symptom:** iOS users see "Cancel anytime in Google Play settings."

**Fix:** In `paywall.tsx`, make the fineprint store-aware:
`Platform.OS === "ios" ? "App Store" : "Google Play"` (pattern already used
across the codebase).

## 6b. Close (X) button on the paywall/pro modal

**Symptom:** The paywall only offers "Maybe later"; the user wants an explicit
close affordance.

**Fix:** Add a top-corner **X** button to `paywall.tsx`, reusing the close-button
pattern from `role-play-picker.tsx` (absolute position, safe-area inset,
Ionicons `close`, `hitSlop`, circular glass background). Additive — "Maybe later"
and swipe-to-dismiss remain.

## 7. Gemini "Kore" (warm) as the global default voice

**Symptom / request:** Make Gemini Kore (warm tone) the default voice for
everyone.

**Fix:** Set `DEFAULT_TTS_CONFIG` in `packages/shared/src/tts-config.ts` to
`{ provider: "gemini", voiceId: "Kore", speed: 1.0, style: "warm" }`. The server
imports the same constant. With voice-keyed greeting caching (item 2), greetings
regenerate under Kore; old nova cache entries go unused. Bundled nova MP3s remain
only as the offline last-resort fallback (chosen scope — not re-bundled).

**Operational note:** This routes every user's greeting and coach turns through
Gemini TTS by default. Gemini Cloud billing on the key's project **must** be
enabled (free-tier quota is tiny). — Confirmed enabled by Bruno on 2026-06-03.

---

## Out of scope / chosen trade-offs

- Not re-bundling the offline greeting MP3s with Kore (item 7 scope decision).
- Auto-scroll keeps the latest message above the mic bar, not literally centered.
- No persistent on-device audio cache purge needed (none exists for greetings).

## Verification

- Backend: vitest for the greeting cache key (voice hash) and the deterministic
  `/opening` route (saved line, no LLM). Extend `voice-opening.test.ts`.
- Mobile (no test runner): manual on-device verification per item — audio stops
  on nav, greeting matches selected voice, Save button gates persistence,
  scenario opener text is instant, auto-scroll tracks streaming, login keyboard,
  paywall store text + X button, Gemini default voice.
