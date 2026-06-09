# Design — Plan 5: Around-the-voice features

**Date:** 2026-05-10
**Status:** Awaiting user review of this spec
**Author:** Bruno + Claude (brainstorming session)
**Parent spec:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`
**Predecessor plan:** `docs/superpowers/plans/2026-05-09-plan-4-voice-loop.md` (DONE)

---

## Summary

Plan 5 builds out the screens and small features that surround the voice loop, so the app feels like a complete product rather than just a mic button. It delivers five user-facing features: a daily-quote home screen with progress + start CTA, a streak-heatmap progress screen, a settings-style editable profile, in-chat translation on coach messages, and OS-share-sheet conversation export.

No data model changes. One new backend route (translation) and one new Postgres RPC (progress summary). The heaviest content lift is authoring 50 hand-curated multilingual daily quotes with translations into all 12 supported languages.

---

## Goals

- **Make the home tab feel like the daily-ritual entry point** — daily quote (signature touch), today's progress, single primary CTA into practice.
- **Give users honest feedback on consistency** — 12-week streak heatmap + lifetime stats on the progress tab.
- **Let users own their account** — display name, native language, learning language, and daily-goal minutes are all editable from the profile tab.
- **Keep the chat useful for actual learning** — tap any coach message to reveal a translation in the user's native language.
- **Enable casual sharing** — one-tap text export of a practice conversation via the OS share sheet.

## Non-goals (explicit)

- **Vocabulary list, topics, push notifications, freemium paywall body.** All deferred to Plan 6.
- **Daily-quote audio (TTS playback).** Considered, then dropped — adds a public Storage bucket + handling for TTS quality on rare languages, for a feature Bruno didn't ask for. Can be added later.
- **Sharing as PDF or to a public web URL.** Plain text via the OS share sheet only. Both alternatives were considered; text is the lowest-friction option that captures the practical value.
- **Editing the user's email address.** Email change goes through Supabase Auth and has its own UX (verification, etc.); deferred to Plan 7.
- **Avatar upload.** Profile shows the first letter of the display name on a colored circle; image upload is not in scope.
- **Translating user messages.** Only coach messages get the translation tap (the user just said it — they don't need it translated).
- **Pro-active translation cache invalidation when target_lang changes.** Past conversations keep their snapshot language; cached `messages.translation` is only stale if the user _also_ changes `native_lang`, in which case we proactively clear the cache (see §6).

---

## 1. Architecture & scope

The plan is mostly client-side. Three additions touch the backend:

- **`POST /v1/messages/:id/translate`** — verifies ownership, calls GPT-4o-mini, caches the result in `messages.translation`. Already declared in the parent spec §4 (Translation). Plan 5 is the first implementation.
- **`get_progress_summary(user_id)` Postgres RPC** — single round-trip read of streak history + aggregates. RLS-protected (user can only call for themselves via `auth.uid()`). New in Plan 5.
- **No new tables, no new columns, no new Storage buckets.** Reads from `profiles`, `conversations`, `messages`, `streak_days` — all created in Plan 2.

The mobile app gains four real screens (replacing the four current stubs in `apps/mobile/app/(tabs)/`), one shared-package data module (`packages/shared/daily-quotes.ts`), one new dependency (`@gorhom/bottom-sheet`), and re-uses the existing TanStack Query + Supabase client wiring from Plans 2-3.

---

## 2. Daily quotes module

### Data shape

`packages/shared/daily-quotes.ts`:

```ts
import type { SupportedLang } from "./languages";

export type DailyQuote = {
  /** Stable id, kebab-case, e.g. "wittgenstein-grenzen". Used for analytics + future audio cache keys. */
  id: string;
  /** The quote in its original language. lang may be ANY language code, including ones not in our SupportedLang set. */
  original: { lang: string; langDisplayName: string; text: string };
  /** Author or source attribution, plain text. */
  attribution: string;
  /** Pre-baked translations into every SupportedLang. Required for all 12 languages — no fallback. */
  translations: Record<SupportedLang, string>;
};

export const DAILY_QUOTES: readonly DailyQuote[] = [
  /* 50 quotes, hand-authored */
];
```

The `translations` field MUST cover every key in `SupportedLang`. A unit test asserts this for every quote — missing translations fail the test suite.

### Cycling

Pure function, deterministic, timezone-aware:

```ts
export function quoteForDay(today: Date, timezone: string): DailyQuote {
  const dayOfYear = computeDayOfYearInTimezone(today, timezone);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}
```

`computeDayOfYearInTimezone` uses `Intl.DateTimeFormat` (Node 22 + RN both support it) to compute the user's local date, then returns the 1-based day-of-year. All users globally see the same quote on the same calendar date in their own timezone — the modulo guarantees stability across years.

### Authoring

Plan 5 ships with **50 quotes**. I (Claude) draft the originals + 12 translations each. Bruno reviews and edits before merge. Originals span a mix of source languages — including non-supported ones (Latin, Sanskrit, Yoruba, Inuit, Japanese, Finnish, etc.) — to deliver on the "any language" promise.

Future plans append to the array; no schema changes needed. A "expand quote catalog to 200" task is filed for Plan 7.

### Why bundled, not GPT-generated

- Zero runtime cost, zero network dependency for the home screen to render.
- Deterministic — same quote everywhere, every day, every install. No "why is mine different from yours" confusion.
- Translation tap is a free local lookup, not an API call.
- Trade-off: requires upfront authoring effort. Mitigated by starting at 50 and growing the catalog over time.

---

## 3. Home screen

### Layout (top to bottom)

```
       Hi <Display name> 👋
       <Day of week>, <Month> <Day>

  ╭────────────────────────────╮
  │   <quote in original lang> │
  │                            │
  │   — <attribution> <flag>   │
  │                            │
  │   ▽ tap for translation    │
  ╰────────────────────────────╯

       <X> / <Y> min today
       ●●●●●●○○○○  60%

  ┌──────────────────────────┐
  │  ▶  Start practicing     │
  └──────────────────────────┘

       🔥 N-day streak
```

### Components

- **Greeting line:** `Hi {profile.display_name} 👋`. Subline: today's date in the user's locale.
- **Quote card:** background-tinted card. Original text in a serif-feeling font (system Georgia equivalent) for visual contrast vs the rest of the app. Below text: attribution + small flag emoji for the original language. Footer hint `▽ tap for translation` (only visible when collapsed).
  - Tap → expands inline with a thin divider, then `quote.translations[profile.native_lang]` in lighter text. Hint changes to `▲ hide translation`.
  - Tap again → collapses.
  - State is local (`useState`); no persistence — closes when leaving the screen.
- **Today's progress:** linear progress bar. Caption `"{minutes} / {goalMinutes} min today"`. When goal is hit, caption replaced with `"🎯 Goal hit — keep going!"` and bar shows in success color.
- **Start practicing:** primary button. Always enabled. Navigates to `/(tabs)/practice`. Quota gating happens server-side mid-session, not as a pre-check on the home screen.
- **Streak badge:** small text below the CTA. `🔥 {N}-day streak` when N > 0, else `Build your first streak today`.

### Data sources

- `useProfile()` (existing from Plan 3) → `display_name`, `native_lang`, `daily_goal_minutes`, `timezone`.
- New `useTodayStats()` hook → reads `streak_days` for `today_in_user_tz` via Supabase, returns `{ secondsSpoken, goalReached }`. TanStack Query, refetch on screen focus.
- `supabase.rpc('current_streak')` (existing from Plan 2) → integer streak count.
- `quoteForDay(new Date(), profile.timezone)` (synchronous, no fetch).

### Files

- `apps/mobile/app/(tabs)/home.tsx` — replaces the stub
- `apps/mobile/src/features/home/quote-card.tsx`
- `apps/mobile/src/features/home/today-progress.tsx`
- `apps/mobile/src/features/home/use-today-stats.ts`
- `packages/shared/daily-quotes.ts` — data + `quoteForDay` + `computeDayOfYearInTimezone`
- `packages/shared/daily-quotes.test.ts`
- Component tests for `quote-card` (tap reveals translation) and `today-progress` (goal-hit state).

---

## 4. Progress screen

### Layout

```
   Progress

   🔥 12-day streak    ⏱ 124 min total

   Last 12 weeks

   ┌─────────────────────────────────┐
   │     Mar     Apr      May        │
   │  M  ■■□□    ■■■      ■■  ■■  …  │
   │  T  ■■■□    ■■□      ■□  ■■  …  │
   │  W  ■□■■    ■■■      □■  ■■  …  │
   │  T  ■■■■    □■■      ■■  ■■  …  │
   │  F  ■□■■    ■■■      ■□  ■■  …  │
   │  S  □□□□    □□□      □□  □□  …  │
   │  S  □□□□    □■□      □□  □■  …  │
   └─────────────────────────────────┘

   ░ no practice  ▒ some  ■ goal hit

   ───────────────────────────

   This week        45 min
   Best streak      23 days
   Sessions total   47
```

### Heatmap mechanics

- Fixed window: **84 days ending today** (12 weeks × 7 rows). Fits one screen, no scroll.
- Three intensity levels mapped from `streak_days`:
  - Empty / no row → `░`
  - Row exists, `goal_reached = false` → `▒`
  - Row exists, `goal_reached = true` → `■`
- Rendered as a `<View>` grid of `<Pressable>` cells. Cell size derived from screen width / 14 (12 weeks plus 2 cells of horizontal padding) so it adapts.
- Tap a cell → `Alert.alert` (Plan 5) or small inline popover (Plan 7 polish): `"May 8 — 12 min · goal hit ✓"` or `"May 9 — no practice"`. Plan 5 ships `Alert.alert` to keep scope tight; popover comes later.
- Month labels above the grid align with the start of each visible month.

### Backend

New Postgres function `get_progress_summary(user_id uuid)`:

```sql
create or replace function get_progress_summary(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_today date;
  v_tz text;
  ...
begin
  -- Reject if not the calling user
  if p_user_id <> auth.uid() then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  select timezone into v_tz from profiles where user_id = p_user_id;
  v_today := (now() at time zone v_tz)::date;

  return jsonb_build_object(
    'current_streak', (select current_streak from current_streak_for(p_user_id)),
    'longest_streak', (select longest_streak_for(p_user_id)),
    'total_minutes', coalesce((select sum(seconds_spoken) / 60 from streak_days where user_id = p_user_id), 0),
    'week_minutes', coalesce((select sum(seconds_spoken) / 60 from streak_days where user_id = p_user_id and date >= v_today - interval '6 days'), 0),
    'total_sessions', (select count(*) from conversations where user_id = p_user_id and ended_at is not null),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('date', date, 'seconds_spoken', seconds_spoken, 'goal_reached', goal_reached)), '[]'::jsonb)
      from streak_days
      where user_id = p_user_id and date >= v_today - interval '83 days'
    )
  );
end;
$$;
```

`security invoker` + the explicit `auth.uid()` check means the RPC respects the caller's identity — a user cannot pass someone else's `user_id`. Tested.

`longest_streak_for` and `current_streak_for` are existing Plan 2 helpers (or will be added as part of this RPC if not present).

Mobile reads it via `supabase.rpc('get_progress_summary')` and renders the result with TanStack Query. Refetch on screen focus.

### Edge cases

- **No `streak_days` rows yet:** RPC returns zeros + empty `days` array. Heatmap shows all-empty grid, stats show zeros, a CTA below the stats reads `"Start practicing to fill in your first day."`
- **Date boundary at midnight in user timezone:** the `v_today` derivation uses `profiles.timezone`, not server UTC, so a session ending at 11:55 PM Paris time counts for the right day.
- **Daylight-saving transition:** dates are dates (no time component) so DST doesn't cause off-by-one.

### Files

- `apps/mobile/app/(tabs)/progress.tsx` — replaces the stub
- `apps/mobile/src/features/progress/heatmap.tsx`
- `apps/mobile/src/features/progress/stats-row.tsx`
- `apps/mobile/src/features/progress/use-progress-summary.ts`
- `apps/api/src/db/migrations/0006_progress_summary.sql` — the RPC + any helper functions
- `apps/api/src/db/migrations/0006_progress_summary.test.ts` — RPC tests against real Postgres (CI service container)
- Mobile component tests for heatmap rendering + tap-cell.

---

## 5. Profile screen

### Layout

```
   Profile

   ╭──────────────────────────╮
   │ B   <Display name>       │
   │     <email>              │
   ╰──────────────────────────╯

   ACCOUNT
   ┌──────────────────────────┐
   │ Display name      <name>>│
   │ Native language   🇫🇷 Fr >│
   │ Learning          🇮🇹 It >│
   │ Daily goal     <N> min  >│
   └──────────────────────────┘

   PLAN
   ┌──────────────────────────┐
   │ ✨ Upgrade to Pro       >│
   │    Coming soon           │
   └──────────────────────────┘

   ┌──────────────────────────┐
   │     Sign out             │
   └──────────────────────────┘

   v<version> (build <buildNumber>)
```

### Header card

Avatar circle with the first letter of `display_name` on a deterministic background color (hashed from `user_id` so it's stable per user). Display name + email below. Email is read-only; tap does nothing in Plan 5.

### Account rows

Each row uses the same `<ProfileRow>` component: label on the left, current value + chevron on the right. Tap → opens a per-field bottom sheet via `@gorhom/bottom-sheet`.

| Row               | Sheet content                                           | Validation                                                  | Save                                                                       |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Display name      | TextInput                                               | 1-30 chars, trim whitespace, no leading/trailing whitespace | `profiles.update({ display_name })`                                        |
| Native language   | Scrollable picker of all 12 `SupportedLang` (with flag) | must be a valid `SupportedLang`                             | `profiles.update({ native_lang })` + clear cached translations (see below) |
| Learning language | Same picker                                             | same                                                        | `profiles.update({ target_lang })`                                         |
| Daily goal        | Numeric wheel picker (5-min increments from 5 to 60)    | integer in `[5, 60]`, multiple of 5                         | `profiles.update({ daily_goal_minutes })`                                  |

After save, the sheet dismisses, the row updates optimistically, and TanStack Query invalidates `profile`, `today-stats`, and `progress-summary` keys so any visible screens refresh.

### Side effects worth flagging

- **Changing `native_lang`** invalidates every cached `messages.translation` for this user (those were translated _to_ the old native language). Plan 5 adds a Postgres RPC `clear_my_translations()` (security invoker, scoped via `auth.uid()`) which runs `UPDATE messages SET translation = NULL FROM conversations WHERE messages.conversation_id = conversations.id AND conversations.user_id = auth.uid()` in one round-trip. The mutation hook calls the RPC after the `profiles.update`. Translations re-compute lazily on next tap.
- **Changing `target_lang`** does NOT touch existing conversations. Each `conversations` row has its own `language` column captured at session start (Plan 2 schema). Future sessions use the new target_lang. No migration, no destructive prompt.
- **Changing `daily_goal_minutes`** does NOT recompute `streak_days.goal_reached` for past days. History is preserved as recorded at the time. Future days use the new goal.

### Plan section

Single row labelled `✨ Upgrade to Pro` with subtitle `Coming soon`. Tap → cross-platform toast `"Pro launches soon — we'll let you know."` (Implementation: `ToastAndroid.show(...)` on Android, `Alert.alert("", message)` on iOS, wrapped in a `showToast(message)` helper in `apps/mobile/src/lib/toast.ts`.) The row is visually styled like a normal row (not greyed out) so the layout reads as final; only the destination changes when Plan 6 ships the real paywall.

### Sign out + version

Sign out keeps the existing `Alert.alert` confirm flow. Version footer reads from `Constants.expoConfig.version` and `Constants.expoConfig.android.versionCode`.

### Files

- `apps/mobile/app/(tabs)/profile.tsx` — replaces the current stub
- `apps/mobile/src/features/profile/profile-row.tsx`
- `apps/mobile/src/features/profile/edit-name-sheet.tsx`
- `apps/mobile/src/features/profile/edit-language-sheet.tsx` — used for both native + target
- `apps/mobile/src/features/profile/edit-goal-sheet.tsx`
- `apps/mobile/src/features/profile/use-update-profile.ts` — TanStack mutation that handles the SQL side-effect for native_lang changes
- `apps/mobile/src/lib/toast.ts` — cross-platform toast helper
- Component tests per sheet (validation + save + dismiss) + a test for the native_lang side effect.

### New dependency

`@gorhom/bottom-sheet` ^5.x. Battle-tested, 14k+ stars, Expo-compatible. Adds `react-native-gesture-handler` and `react-native-reanimated` as peer deps — both already pulled in via Expo Router. Requires a fresh dev build (one native module added).

---

## 6. Translation toggle

### UX

- Each coach bubble in the chat list becomes a `<Pressable>`.
- Initial state: shows original text only, with a small `🌐` icon in the bottom-right of the bubble (discoverable affordance).
- Tap → calls `POST /v1/messages/:id/translate` (loading spinner replaces the icon for ~500ms in the typical case), then renders the translation beneath the original with a thin divider, in lighter text:
  ```
  ╭─────────────────────────────╮
  │ Coach:                      │
  │  Buongiorno! Come stai?     │
  │  ─────────────────────────  │
  │  Bonjour ! Comment ça va ?  │
  ╰─────────────────────────────╯
  ```
- Tap again → collapses back to original-only. Translation stays cached server-side; subsequent opens are instant.
- User bubbles are non-tappable (you said it, you don't need it translated).

### Backend route

```
POST /v1/messages/:id/translate
  Auth:    required (JWT)
  Path:    messageId (uuid)
  Body:    none
  Response 200: { translation: string }
  Errors:
    401 UNAUTHORIZED         — missing/invalid JWT
    404 NOT_FOUND            — message doesn't exist OR doesn't belong to caller
    422 NOT_TRANSLATABLE     — message.role !== 'coach'
    503 LLM_PROVIDER_FAILURE — GPT call failed
```

Server logic:

1. Load `message` joined with parent `conversations` (one query).
2. If `conversations.user_id !== auth.userId` → 404 (don't leak existence).
3. If `message.role !== 'coach'` → 422.
4. If `message.translation` is non-null → return it (cache hit).
5. Load `profiles.native_lang` for the user.
6. Call GPT-4o-mini with system prompt `"You are a translator. Translate the user message into {nativeLanguageDisplayName}. Preserve tone and register. Do not add commentary or quotation marks."` and user content = `message.text`.
7. `UPDATE messages SET translation = <result> WHERE id = :id`.
8. Return `{ translation }`.

Idempotent: any number of calls return the same cached result after the first.

### Cost note

GPT-4o-mini ≈ $0.00006 per coach-message translation (50 in + 50 out tokens). Negligible. Cached after first call.

### Files

- `apps/api/src/routes/messages.ts` — new route module
- `apps/api/src/routes/messages.test.ts` — happy path, 401, 404, 422, cache-hit
- Wire into `apps/api/src/app.ts` under `/v1`
- `apps/mobile/src/features/practice/api-translate.ts` — API client function
- `apps/mobile/src/features/practice/use-translate-message.ts` — TanStack mutation
- `apps/mobile/src/features/practice/chat-bubble.tsx` — extracted from `practice.tsx`, supports tap-to-translate
- Update `apps/mobile/app/(tabs)/practice.tsx` to use the new `chat-bubble` component

---

## 7. Share conversation

### UX

- Header button on the practice screen (right side): a share icon (`Ionicons` name `share-outline`).
- Disabled when the conversation has zero messages.
- Tap → builds the transcript as plain text → calls `Share.share({ message: transcript })` from React Native's `Share` API. OS share sheet appears.
- Transcript format:

  ```
  My Language Coach — Italian practice
  May 10, 2026 · 6 min

  You: Buongiorno!
  Coach: Buongiorno! Come stai oggi?
  You: Sto bene, grazie. Vorrei imparare l'italiano.
  Coach: Bravissimo! Da dove vorresti iniziare?

  Practice with me at mylanguagecoach.app
  ```

- Header line: `My Language Coach — {languageDisplayName} practice`.
- Date line: `{localizedDate} · {durationMinutes} min`.
- Body: `You: {text}` / `Coach: {text}`, one message per line, blank line between turns is optional (skip — keeps the transcript tight).
- Footer: a single soft attribution line. The URL doesn't need to resolve in Plan 5; it's just credit. Real landing page can come later (out of scope for v1 entirely per parent spec).

### No backend

Pure client-side using React Native's built-in `Share` API. No new dependency. No data egress beyond what the user explicitly shares via the OS sheet.

### Files

- `apps/mobile/src/features/practice/build-transcript.ts` — pure function `(conversation, messages) => string`
- `apps/mobile/src/features/practice/build-transcript.test.ts` — covers empty, one turn, multiple turns, language name lookup
- `apps/mobile/src/features/practice/share-button.tsx` — header button + share handler
- Modify `apps/mobile/app/(tabs)/practice.tsx` to render the share button in the screen header

---

## 8. Testing strategy

Following the parent spec's 80% coverage target on shared/api/lib code.

**Shared package:**

- `daily-quotes.test.ts` — every quote has all 12 translations; cycling is deterministic given a date + timezone; cycling is stable across years.

**API:**

- `routes/messages.test.ts` — translate endpoint: 401, 404 (other user's message + nonexistent), 422 (user message), happy path (calls GPT, caches), cache hit (no GPT call on second invocation).
- `db/migrations/0006_progress_summary.test.ts` — RPC: empty user (zeros + empty days), populated user (correct streak/total/week/days), unauthorized user_id rejected.

**Mobile (component + hook tests via Vitest + RNTL):**

- `quote-card`: renders original, tap reveals translation, tap again hides.
- `today-progress`: progress bar renders, goal-hit state shows correct caption.
- `heatmap`: renders 84 cells, three intensity levels render correctly, tap shows alert.
- `edit-name-sheet`, `edit-language-sheet`, `edit-goal-sheet`: validation rejects invalid input, save calls mutation, sheet dismisses.
- `use-update-profile`: native_lang change triggers translation cache clear.
- `chat-bubble`: tap calls translate mutation, response renders below original, second tap hides.
- `build-transcript`: covered above.

**Manual on device:**

- Launch home → quote shows in original, tap → translation reveals.
- Practice → exchange messages → tap coach bubble → translation appears.
- Practice → tap share → OS share sheet appears with formatted transcript.
- Profile → change display name, native lang, target lang, daily goal — all persist across app restart.
- Progress → heatmap renders, today's cell goes from empty to filled after a session.

---

## 9. Open questions / future work

- **Daily-quote audio (🔊 button).** Dropped from Plan 5 to keep scope tight. If we want it later: lazy server-side TTS + public Storage cache. ~$0.015 one-time cost per quote, ever.
- **Heatmap tap → popover** instead of `Alert.alert`. Plan 7 polish.
- **Avatar upload.** Plan 7 or later.
- **Email change flow.** Plan 7.
- **Quote catalog growth from 50 → 200.** Plan 7 task.
- **Translating user messages** (not just coach). YAGNI for now.
- **Offline mode for the home screen** (cache the quote, render without network). Plan 7 polish.

---

## References

- Parent spec: `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`
- Plan 4 (predecessor): `docs/superpowers/plans/2026-05-09-plan-4-voice-loop.md`
- `packages/shared/languages.ts` — `SupportedLang` definition
