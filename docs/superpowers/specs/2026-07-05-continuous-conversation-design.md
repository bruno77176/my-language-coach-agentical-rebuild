# Continuous conversation ("infinite thread") — design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation plan
**Backlog item:** Continuous conversation (NEW — see `PRE-LAUNCH-BACKLOG.md`)

## Problem

Every time the user opens Practice, the client creates a brand-new `conversations`
row, wipes the on-screen messages, and plays a formal greeting ("Hello {name}…").
Prior messages are never reloaded — each conversation is its own island. The result
feels unnatural: you "start over" every session instead of continuing a relationship.

Coach _memory_ already persists across sessions (Plan 8 extraction), but the **visible
chat and the greeting reset every time**.

## Goal

Make free-form practice feel like one continuous thread, per language — like WhatsApp
with a contact:

- Re-opening a language shows your previous messages and lets you continue.
- **No greeting on re-entry** — the coach stays silent until you speak. (First-ever
  conversation for a language still greets once.)
- The coach continues naturally, with prior context.
- Feedback + coach-memory + streak still happen — but decoupled from "session end,"
  since the thread never ends.

## Decisions (locked)

1. **Unit:** one continuous thread per **(user, language)**, free-form practice only.
   Role-play **scenarios keep today's behavior** (own row, in-character opener,
   explicit end → feedback) and are out of scope.
2. **Re-entry greeting:** none. Silent continue when history exists; greet once on the
   very first conversation for a language.
3. **Feedback/memory model:** a **checkpoint** ("Wrap up & get feedback") generates
   feedback + extracts memory + updates streak for the turns since the last checkpoint,
   **without clearing the chat or ending the thread**. Plus an **auto-checkpoint on
   inactivity** so closing the app still earns feedback/memory/streak.
4. **Inactivity gap:** 30 minutes (tunable via config constant).
5. **Wrap-up button:** kept as a visible action _and_ auto-checkpoint on inactivity —
   button = "give me feedback now," auto = "I just left."

## Approach (chosen)

**Persistent thread + checkpoints.** The existing `conversations` row _is_ the thread
(one per user+language, `scenario_id IS NULL`). Messages accumulate on it forever. The
LLM already continues from a conversation's own history (`recentHistory = history.slice(-20)`,
`voice.ts:571-598`), so coach continuity is automatic — it's the same row.

Rejected alternatives:

- **Visual stitching over per-session rows** — continuity faked across two message
  stores; still needs cross-row context seeding; awkward pagination/repeat/translate
  across the seam.
- **New `threads` table + conversations-as-segments** — cleanest schema but a migration
  touching every conversation query; overkill for the same UX.

## Data model changes

### `conversations`

- Add `kind text NOT NULL DEFAULT 'session'`. Thread rows are `'thread'`. Used to
  (a) find/reuse the thread and (b) exclude threads from "Recent sessions" (they never
  end). Legacy + scenario rows stay `'session'`.
- Thread rows keep `ended_at = NULL` permanently. `seconds_spoken` accumulates per-turn
  (already happens at `voice.ts:703`), not via wall-clock at end.
- One thread per (user, language): a partial unique index
  `ON conversations(user_id, language) WHERE kind = 'thread'` guards against races
  creating duplicates.

### New table `session_checkpoints`

```
id            uuid pk default random
conversation_id uuid not null references conversations(id) on delete cascade  -- the thread
user_id       uuid not null references profiles(user_id) on delete cascade
language      text not null
started_at    timestamptz not null   -- previous checkpoint's ended_at, or thread start
ended_at      timestamptz not null   -- when this checkpoint fired
seconds_spoken integer not null default 0  -- wall-clock started_at→ended_at
created_at    timestamptz not null default now()
index (user_id, ended_at desc)
```

A checkpoint = one "practice segment." Scenario conversations do **not** use checkpoints
(they keep the `/end` path).

### `session_feedback`

Today the PK is `conversation_id` (1:1 with a conversation). A thread has many segments,
so feedback must key on the checkpoint:

- Add `checkpoint_id uuid references session_checkpoints(id) on delete cascade`.
- Move the identity to `checkpoint_id` for new (thread) feedback. Keep `conversation_id`
  populated for backward-compat reads; existing legacy/scenario feedback rows (keyed by
  conversation) remain valid. Drop the `conversation_id` **primary-key** constraint;
  add a unique index on `checkpoint_id` and keep a plain index on `conversation_id`.
  Recents/transcript for threads read by checkpoint; scenarios/legacy read by
  conversation as today.

### `digest_jobs` (gotcha)

`insert(digestJobs)…onConflictDoNothing()` is idempotent on `conversation_id`
(`voice.ts:1077-1087`). On a thread, only the first checkpoint would enqueue a digest.
Add `checkpoint_id` to `digest_jobs` and make idempotency key on `checkpoint_id` for
thread checkpoints (keep `conversation_id` for scenario ends).

## API changes (`apps/api/src/routes/voice.ts`)

### Thread resolution — extend `POST /sessions` (or new `POST /threads`)

For free-form (no `scenario_id`):

1. Find the thread: `conversations` where `user_id`, `language`, `kind='thread'`.
   Create it (`kind='thread'`) if none — under the partial unique index.
2. Before returning, run **stale-segment auto-checkpoint** (see below).
3. Return `{ conversation_id, kind:'thread', is_new_thread, messages: [last N],
has_more, daily_used_seconds, daily_cap_seconds, reset_at, ad_extensions_remaining }`.
   The existing daily-cap 429 gate stays exactly as-is.

Scenario sessions keep creating a fresh `kind='session'` row (unchanged).

### Message pagination — reuse `GET /sessions/:id/messages`

Add optional `before` (cursor = oldest loaded `created_at`) + `limit` for "load earlier."
Ownership check unchanged.

### `POST /sessions/:id/checkpoint` (new) — the wrap-up

On the thread `id`, over messages with `created_at > last_checkpoint_ended_at`
(or thread start if none):

1. Compute `seconds_spoken = now − segment_start` (wall-clock), same convention as `/end`.
2. Insert a `session_checkpoints` row (`started_at`, `ended_at=now`, `seconds_spoken`).
3. Upsert `streak_days` for today (+seconds, OR goal_reached) — unchanged logic.
4. Fire-and-forget **memory extraction** over the **segment** transcript (bounded by
   `started_at`), same as `voice.ts:1010-1073` but range-scoped.
5. Insert **pending feedback** row keyed to the checkpoint + fire `generateFeedback`
   over the segment transcript (same as the current end path, range-scoped).
6. Enqueue **digest job** keyed on `checkpoint_id`.
7. **Do not** set `ended_at` on the thread. Return `{ checkpoint_id, seconds_spoken,
   goal_reached }`.
   `scheduleOnboardingPushes` stays idempotent-per-user and runs here too (first checkpoint).

### Auto-checkpoint on inactivity

On thread resolution (and optionally a server reaper later): if the newest message is
older than `INACTIVITY_CHECKPOINT_MINUTES` (30) **and** there are un-checkpointed
messages, fire the checkpoint logic above for that stale segment _before_ returning the
thread. This gives feedback/memory/streak to users who just close the app. Idempotent:
if no un-checkpointed messages, no-op.

### `/end` (scenarios only)

`POST /sessions/:id/end` stays for scenario rows. For thread rows it becomes a no-op
alias for `/checkpoint` (defensive — the client won't call it on threads).

## Client changes (`apps/mobile`)

### `use-conversation.ts` (session-start effect, `:152-247`)

- Call thread-resolution instead of `startSession` for free-form. Seed `messages` from
  the returned page (mapped to `ChatMessage`), oldest→newest.
- **Greeting:** only when `is_new_thread` (no history). Otherwise skip greeting text +
  audio entirely.
- Keep the daily-cap publish + 429→limit-screen redirect exactly as-is.
- Scenario path (`scenarioId` set) unchanged.

### Pagination

"Load earlier messages" affordance at the top of the transcript → `before` cursor fetch,
prepend older page. (Windowed list; FlashList/inverted or head-prepend — pick during plan.)

### Wrap-up

Rename the End action to **"Wrap up & get feedback."** Calls `/checkpoint`; on success,
route to the feedback/end-of-session screen for `checkpoint_id`, but **leave the thread
mounted** so returning continues the same chat (no re-greet, messages intact).

### Recents + transcript

- "Recent sessions" (`practice.tsx`) lists recent **checkpoints** (id, ended_at,
  seconds_spoken, feedbackStatus) via a checkpoint-shaped `sessions/recent`.
- Transcript modal for a checkpoint loads messages in `[started_at, ended_at]`.

### Retire/park stale-session resume

`ACTIVE_SESSION_KEY` + `use-stale-session-guard` existed to resume an in-flight session
after backgrounding. With a persistent thread, resume is implicit. Park (leave dormant)
in this slice; remove in a follow-up to limit blast radius.

## Config

- `INACTIVITY_CHECKPOINT_MINUTES` = 30 (`apps/api/src/env.ts`).
- `THREAD_HISTORY_PAGE_SIZE` = e.g. 30 (initial + "load earlier" page).

## Out of scope

- Role-play scenarios (unchanged).
- Server reaper for users who never return (auto-checkpoint on next entry covers the
  common case; a cron reaper can follow).
- Removing the stale-session resume machinery (park now, delete later).
- Cross-language "single thread" (explicitly rejected).

## Non-regression / risks

- **Feedback/memory/streak must not silently stop.** The checkpoint mechanism is the
  replacement trigger — it ships in this slice, not later. Tests assert feedback +
  memory + streak fire on both manual and inactivity checkpoints.
- **Quotas unaffected:** the per-turn daily wall-clock cap still applies, so an
  "infinite" thread is still bounded by daily minutes. No monetization regression.
- **`session_feedback` PK migration** must preserve existing rows (legacy/scenario keyed
  by conversation).
- **`digest_jobs` idempotency** must move to `checkpoint_id` for threads or digests
  after the first are silently dropped.
- **Duplicate-thread race** guarded by the partial unique index + upsert-on-conflict.

## Testing

- Thread resolution: creates once, reuses on subsequent calls, unique per language.
- Greeting: greet on first-ever; silent when history exists.
- Turn continuity: LLM history spans prior turns on the same thread.
- Checkpoint (manual): feedback pending→ready, memory updated, streak +seconds, segment
  range correct, thread `ended_at` still NULL, chat not cleared.
- Auto-checkpoint: stale segment on re-entry fires exactly one checkpoint; fresh re-entry
  does not.
- Recents/transcript by checkpoint.
- Scenarios still isolated (own row, `/end`, unaffected).
