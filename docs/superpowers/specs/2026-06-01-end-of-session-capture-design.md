# Robust end-of-session capture

**Date:** 2026-06-01
**Author:** Bruno + Claude (brainstorming)
**Status:** Spec — pending plan

## Problem

The feedback report (highlights, things to polish, new vocabulary) and coach memory write are the most valuable artifacts of a conversation, but they only fire when the user explicitly taps "End ▸" in the top-right header. In external testing two friends ran a full conversation and walked away without tapping End, so they got nothing — no feedback, no memory, no streak credit. The coachmark added in Plan 7 did not fix it. The header pill is in the wrong place; users do not associate "End" with "get my feedback."

## Goal

Make sure every meaningful conversation produces a feedback report and a memory write, even when the user does not deliberately end it. Below the value threshold, sessions are silently discarded — no thin summaries, no wasted LLM calls, no streak credit for accidentally-opened sessions.

## Invariants

1. **Single end path.** Every code path that finishes a session — manual press, tab-nav confirm, stale auto-end — calls the same `endSession(conversationId)` (`apps/mobile/src/lib/api-client.ts:53`). That server route (`POST /sessions/:id/end` at `apps/api/src/routes/voice.ts:455`) already triggers feedback generation, daily-goal credit, and fire-and-forget memory extraction (gated by `profile.memoryEnabled`). The spec does not add a parallel memory-write — it relies on this invariant.
2. **Eligibility threshold.** A session is "eligible for summary" iff `userTurnCount >= 1 AND secondsSpoken >= 30`. Below threshold, auto-paths silently discard the conversation row (`endSession` is not called); manual end still calls `endSession` so the user gets whatever the server can produce (their explicit intent overrides the threshold).
3. **Staleness threshold.** A session is "stale" iff `now - lastActivityAt > 5 minutes`.
4. **Auto-end never fires while the user is actively engaging.** Auto-end only checks staleness on AppState transitions to `active` (foreground) and on cold start.

## Three-layer affordance design

### Layer 1 — Primary: bottom CTA

A pill labeled "End & see feedback" sits centered above the mic button. Hidden during the greeting / empty-state phase; appears (fade-in, ~200ms) the moment `userTurnCount >= 1`. Tap shows the standard confirm alert; confirm runs `confirmAndEnd()`.

The bottom CTA replaces the header End pill as the primary affordance. The header pill is **removed entirely**. The coachmark file `apps/mobile/src/features/practice/end-button-coachmark.tsx` is **deleted**.

### Layer 2 — Tab-nav interception

When the user taps Home / Progress / Profile while an active conversation exists, the tab press is intercepted and the same confirm alert is shown. Two buttons:

- **"End & see feedback"** — calls `confirmAndEnd()`, which ends, routes to the end-of-session modal, and after dismissal the user lands on their originally tapped tab (the modal is a presented modal, not a replacement).
- **"Just leave"** — releases the navigation, switches to the tapped tab. The active session **stays alive** in memory + AsyncStorage. Layer 3 catches it if the user never returns.

### Layer 3 — Stale-session auto-end

On every AppState transition to `active` (foreground) and on cold start of the mobile app, check AsyncStorage for a persisted active session:

- If exists and `now - lastActivityAt > 5 min` and eligible → call `endSession(id)`, clear storage, route to `/(modals)/end-of-session` with the returned `{conversationId, secondsSpoken}`.
- If exists and stale but **not** eligible → clear storage, no server call, no modal. Silent discard.
- If exists and **not** stale → do nothing; the user is resuming a recent session (`useConversation` is either still mounted with the same `conversationId`, or the user returned within 5 min and we let the next user turn or manual end pick it up).
- If not exists → do nothing.

## Component changes

### `apps/mobile/src/features/practice/use-conversation.ts`

Add to the hook's tracked state and return:

- `userTurnCount: number` — incremented when a user turn completes (after STT returns, before LLM stream).
- `lastActivityAt: number` (ms epoch) — updated when any user or coach turn completes and when `start()` runs.
- `isEligibleForSummary(): boolean` — `userTurnCount >= 1 && session-timer seconds >= 30`. The session-timer value is already in `practice.tsx` via `useSessionTimer`; expose it back to the hook OR compute eligibility in `practice.tsx` and pass it down where needed. (Plan-phase decision; either works.)

After every turn completion (user or coach) **and** on the initial `start()` call, write to AsyncStorage:

```ts
await AsyncStorage.setItem(
  "active-session.v1",
  JSON.stringify({ conversationId, lastActivityAt, eligible })
);
```

On successful `end()` return, clear it: `AsyncStorage.removeItem("active-session.v1")`.

### `apps/mobile/app/(tabs)/practice.tsx`

- Remove `<EndButtonCoachmark />` from the render tree.
- Drop the `onExit` prop from `<TopStatusBar>`.
- Add `<EndSessionCTA visible={userTurnCount >= 1} onPress={confirmAndEnd} />` directly above `<MicButton />` inside the `micBar` `View`. Layout: CTA pill, then `processingPill` (if visible), then mic. (Order/spacing tuned during implementation.)
- Extract the existing `onExit` Alert into a single `confirmAndEnd()` function used by both the CTA and the tab-nav interceptor.
- Set a global "has active session" flag (Zustand store or a Context) on mount, clear on unmount and on successful end.

### `apps/mobile/src/features/practice/top-status-bar.tsx`

- Remove the End pill (lines around `endButton`/`endLabel` styles).
- Drop the `onExit: () => void` prop.
- Layout stays: timer pill left, listening toggle + ShareButton right.

### New: `apps/mobile/src/features/practice/end-session-cta.tsx`

```tsx
type Props = { visible: boolean; onPress: () => void };
```

A `GlassCard` pill with `radiusToken="pill"`, label "End & see feedback" + small chevron icon. Wrapped in an `Animated.View` with fade-in driven by `visible`. Same `palette` tokens as the existing End pill so it visually belongs to the family.

### New: `apps/mobile/src/features/practice/use-stale-session-guard.ts`

Encapsulates the Layer 3 logic. Mounts on the Practice screen (and possibly the root layout — see open question below). Reads AsyncStorage on:

1. Initial mount (covers cold start).
2. `AppState.addEventListener("change", handler)` when state becomes `"active"`.

When triggered with a stale + eligible session, calls `endSession`, clears storage, and `router.replace`s to `/(modals)/end-of-session` with the returned params.

### New: `apps/mobile/src/features/practice/active-session-flag.ts`

A tiny Zustand store (or Context, equivalent) with:

```ts
{ activeConversationId: string | null;
  setActive: (id: string | null) => void; }
```

Set when `ActiveConversation` mounts with a real `conversationIdRef`, cleared on unmount or successful end. Read by the tab-nav interceptor in `_layout.tsx`.

### `apps/mobile/app/(tabs)/_layout.tsx`

Attach `screenListeners` (or per-screen `listeners`) to intercept `tabPress`. When the press is for a tab whose name is not `practice` AND `activeConversationId` is set, call `e.preventDefault()` and show the confirm Alert. On "End & see feedback" → run `confirmAndEnd()` (imported / passed via store callback), then `router.replace` to the originally requested tab after the feedback modal is dismissed (or use the natural modal-on-top stack). On "Just leave" → manually navigate to the requested tab.

## Confirm-alert copy (single source of truth)

Title: **End conversation?**

Body (when `profile.memoryEnabled === true`): **"Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Plus your coach will remember what matters from this chat next time. Your practice time also goes toward your daily goal and streak."**

Body (when `profile.memoryEnabled === false`): **"Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Your practice time also goes toward your daily goal and streak."**

(We don't promise memory if the user disabled it. The memory line is the only difference between the two copies.)

Buttons: **"Keep talking"** (cancel) · **"End & see feedback"** (default).

The same Alert is used by the bottom CTA and the tab-nav interceptor. Stale auto-end skips the alert (the user is not on the screen).

## Data flow summary

```
manual press (bottom CTA)
   └─> confirmAndEnd()
       └─> end()  ──> endSession()  ──┐
                                      ├─> feedback gen
                                      ├─> memory extraction (consent gate)
                                      └─> daily-goal/streak credit
                                      ──> route to /(modals)/end-of-session

tab-nav with active session
   └─> intercept tabPress
       ├─> "End & see feedback" → confirmAndEnd()  (same as above)
       └─> "Just leave" → navigate; session stays alive

stale on foreground / cold start
   └─> useStaleSessionGuard
       └─> eligible? → endSession() (same downstream)
       └─> not eligible? → silent discard, clear storage
```

## What we explicitly do NOT do

- **No idle-timer auto-end while foregrounded.** Sitting and thinking is not abandonment. Decided in brainstorming.
- **No push notification on auto-end.** Feedback surfaces the next time the user opens the app via the modal route; not worth the notification permission cost.
- **No "are you sure" on bottom CTA other than the existing Alert.** The Alert is the confirmation; no second sheet.
- **No backward compatibility for the old coachmark seen-flag** (`AsyncStorage` key `coachmark.end-button.seen.v1`). It stays orphaned in users' storage; harmless. We do not need a migration to clear it.
- **No tab-nav interception on the Practice tab itself.** Tapping Practice while on Practice is a no-op as today.

## Open questions for the plan phase

1. **Where to mount `useStaleSessionGuard`?** On the root `(tabs)/_layout.tsx` (catches every app entry) or on the Practice screen alone (catches when the user navigates to Practice)? Root is safer; pick that unless there's a reason not to.
2. **Active flag store choice.** Zustand vs Context — convention check during implementation. The codebase uses Zustand for `useConversationStore` (if it exists) — match the existing pattern.
3. **Tab-nav interception API.** Exact React Navigation / expo-router hook for blocking a tab press (`screenListeners.tabPress` vs per-screen `listeners` prop). Pick during plan.

## Verification plan

There is no automated test runner for the mobile app — verification is manual on a real device. After implementation, verify each of these on an Android dev build:

1. **Bottom CTA appears at the right time.** Start a free conversation. CTA is hidden in greeting state. Speak once (one full turn). CTA fades in.
2. **Manual end (bottom CTA).** Tap CTA → confirm alert → "End & see feedback" → end-of-session modal opens with this conversation's feedback. Memory write fires (verify via `select * from coach_memory where user_id = ... and target_lang = ...` after a 5-10s lag).
3. **Tab-nav "End & see feedback".** Mid-conversation, tap Home tab → confirm alert appears → "End & see feedback" → end-of-session modal opens.
4. **Tab-nav "Just leave".** Same setup → "Just leave" → Home tab opens, session stays alive. Tap Practice → conversation is still there with all messages. Tap CTA → end normally.
5. **Stale auto-end, foreground path.** Conversation with ≥1 turn + ≥30s spoken. Background the app for 6 min. Foreground → end-of-session modal opens automatically with this session's feedback. AsyncStorage `active-session.v1` is cleared.
6. **Stale auto-end, cold start.** Same setup but kill the app entirely (force-stop). Wait 6 min. Open the app → end-of-session modal opens automatically.
7. **Stale but ineligible.** Open a fresh conversation, do not speak. Background for 6 min, return. Modal does NOT open; storage is cleared; no feedback row.
8. **Sub-threshold manual end.** Open a fresh conversation, do not speak. Tap CTA — CTA should not be visible yet (gated on `userTurnCount >= 1`), so the only way to end is via tab-nav. Tab-nav confirm → "End & see feedback" → end-of-session modal opens with empty/placeholder feedback (server handles thin sessions; verify it does not crash).
9. **Header is clean.** Verify no End pill, no coachmark, no leftover layout glitch in `TopStatusBar`. Listening toggle + Share button still work.
10. **Memory write on every end path.** For each of (2), (3), (5), (6), confirm a memory row was created or updated for the user × target_lang combination (with `memory_enabled = true` in the profile).

## Out of scope

- Onboarding hint for the bottom CTA. The label is self-explanatory; we trust it.
- Renaming the end-of-session modal or restructuring its contents.
- Server-side cleanup of orphaned `conversations` rows older than N days (separate cleanup concern; the schema already tolerates open rows).
- Re-doing the daily-goal reward timing on auto-end. The existing `useGoalReward` hook fires based on `todaySeconds`; auto-end credits the seconds before the user is back on Practice, so the reward will fire the next time they visit Practice if the threshold was newly crossed. Acceptable.
