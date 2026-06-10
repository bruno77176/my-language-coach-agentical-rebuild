# Daily Wall-Clock Cap + "Daily limit reached" Chooser — Plan

**Date:** 2026-06-10
**Branch:** `resume-revenuecat`
**Supersedes/extends:** `specs/2026-06-04-daily-limit-fix-and-screen-design.md`
(keeps its local-midnight reset, polished screen, session-start gate, and
error-parse fix — but **changes the metric to wall-clock** and makes both
chooser paths live.)

## Decisions (locked with Bruno, 2026-06-10)

- **Metric = wall-clock conversation time** (the on-screen session timer), NOT
  transcribed-speech seconds.
- **Free = 10 min/day, Pro = 60 min/day. Both HARD caps.** Reset at **local
  midnight** (user's `profiles.timezone`).
- **Enforcement = both:** client timer stops the session + opens the limit
  screen the instant the budget is hit (early, graceful); the server
  independently accumulates clamped elapsed time and rejects turns past the cap.
- **Limit screen is a chooser:** "Watch an ad for +3 min" OR "Go Pro".
  - **Go Pro** → existing paywall → on success **resume the same conversation**.
  - **Watch ad +3 min** → **stubbed** this milestone (simulate a successful
    watch, grant +3 min server-side, max **2×/day**). Real AdMob deferred.
- **Max tier** (avatar video / web) is future — leave entitlement room, don't
  build.

## Server measurement mechanism (the non-obvious bit)

The server only sees discrete turn requests, so it can't watch a wall clock.
Mechanism:

- Client owns the `useSessionTimer` (active conversation seconds) and sends
  `elapsedDeltaSeconds` (timer advance since the previous turn) on each turn.
- Server accumulates `clamp(delta, 0, MAX_TURN_WALLCLOCK_DELTA=180)` into the
  daily counter — clamp bounds a tampered client and idle gaps.
- Server **pre-gate**: block the turn / session-start iff `usedToday >= cap`
  (estimate-free; the budget is time already spent).
- Client also enforces locally so the user never wastes a blocked turn.

The displayed timer therefore _is_ the cap, while the server clamp is the
anti-abuse backstop. `dailyVoiceSecondsUsed` is repurposed to mean wall-clock
seconds (no rename; semantics change + comment).

## Server changes (`apps/api`)

1. **`lib/daily-window.ts`** (new, from the 2026-06-04 spec): `localDayKey(tz)`
   - `nextLocalMidnightUtc(tz)` via `Intl`. No new dep. Unit-tested (DST +
     non-DST tz).
2. **`lib/quota.ts`** rewrite:
   - `canUseSecondsDaily(entitlement, tz, now?)` → block iff `usedToday >= cap`
     (used reset to 0 on a new local day). Free cap 600, **Pro cap 3600 HARD**
     (remove the soft-cap allow-over). `resetAt = nextLocalMidnightUtc`.
   - Keep `dailyVoiceSecondsUsed` as the counter; add `dailyAdExtensions`.
3. **`db/migrations/00NN_daily_ad_extensions.sql`** (hand-written): add
   `entitlements.daily_ad_extensions int not null default 0`.
4. **`routes/voice.ts`**:
   - Turn accumulation → `usedToday += clamp(body.elapsedDeltaSeconds,0,180)`
     (replaces `secondsThisTurn = stt.durationSeconds`). Day-key reset.
   - Pre-turn + **session-start** gate via the new `canUseSecondsDaily`
     (pass `profile.timezone`). 429 `{ error:{ code:"DAILY_QUOTA_EXCEEDED",
message, resetAt } }`.
   - **Session-start response** returns `{ dailyUsedSeconds, dailyCapSeconds,
resetAt }` so the client can run the local timer enforcement.
5. **`POST /v1/voice/ad-extension`** (new): if `dailyAdExtensions < 2`, subtract
   180 s from `dailyVoiceSecondsUsed` (floor 0) and `dailyAdExtensions += 1`;
   else 409. Returns the refreshed budget. (Stub = no ad verification yet.)
6. Drop the unused monthly enforcement confusion (leave `canUseSeconds` but mark
   vestigial) — out of scope to delete.

## Client changes (`apps/mobile`)

7. **`api-client.ts`**: fix the SSE error parse (try `JSON.parse(e.message)`),
   emit `{ type:"error", code:"DAILY_QUOTA_EXCEEDED", resetAt }`; `startSession`
   throws typed `DailyQuotaError` on 429; carry `dailyUsedSeconds/Cap/resetAt`.
8. **Turn requests** include `elapsedDeltaSeconds` from the session timer.
9. **`use-conversation.ts`**: track budget; when `timer + usedToday >= cap` (or
   the server 429s), `router.push("/(modals)/daily-limit", { resetAt })`. On
   return from a successful upgrade/ad-grant, refresh budget (or `isPro`) and
   **resume** the conversation (modal over Practice keeps it mounted).
10. **`/(modals)/daily-limit.tsx`** (new) — gradient `Screen`, `EditorialText`:
    - "You've used your free 10 minutes today." + live countdown to `resetAt`.
    - **[Watch an ad for +3 min]** → stub: call `/voice/ad-extension` → on
      success dismiss + resume (disabled once 2×/day used).
    - **[Go Pro]** → `/(modals)/paywall` → on `isPro` dismiss + resume.
    - X close → `router.replace("/(tabs)/home")`.

## Tests

- `daily-window.test.ts`, `quota.test.ts` (day-change reset, correct resetAt,
  free + Pro hard block), `voice` session-start + turn 429, ad-extension
  (grant, 2×/day cap). Mobile: manual on-device (10-min wall, 5+5 accumulation,
  Go-Pro-resume, ad-+3-resume).

## Test/deploy note

Client changes hot-reload via Metro. Server changes need the API reachable:
deploy `apps/api` to Fly (pre-launch, acceptable) **or** run the API locally and
`adb reverse tcp:3000 tcp:3000`. Decide at test time.
