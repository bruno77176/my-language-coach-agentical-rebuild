# Spaced-repetition review for the word deck (BRU-30)

**Date:** 2026-06-26
**Linear:** BRU-30 — "Word deck — science-based spaced-repetition review"
**Status:** Approved design, pending implementation plan

## Problem

The vocab deck has no review scheduling. `vocab_items.mastery` is a crude 0–3
counter; the review screen snapshots **every** card with `mastery < 3` and
quizzes them all in one session. With 100+ saved words this is an unbounded,
demoralising wall — there's no way to actually get through them, and nothing
resurfaces words at growing intervals the way real learning needs.

Goal: a pedagogically sound spaced-repetition flow that (a) shows a **sensible,
bounded amount per day** and (b) **rotates words at research-backed intervals**.

## Decisions (locked with Bruno, 2026-06-26)

- **Grading stays binary** via the existing pronunciation flow (speak the word →
  STT decides right/wrong). No self-grade buttons, no quality scale.
- Binary grading ⇒ **Leitner box system** (not SM-2, which needs a 0–5 quality).
- **Single daily target: ~15 cards.** Due reviews first, then new words fill up
  to 15. Overflow due cards roll to the next day.
- **In-app surfacing only.** Home shows "N words due today" + a Review button.
  No push reminders — reminder strategy stays with BRU-21.
- Hardcode the daily target (15) and intervals; expose as settings later if
  wanted. No per-user configuration now.

## Algorithm — Leitner ladder

Each word sits in a **box** (1–6). The box determines how long until it's next
due. A correct answer promotes the word one box (longer interval); a wrong
answer drops it back to box 1 (due next session). A word is never deleted — even
a "mastered" (box 6) word resurfaces after ~60 days so it stays durable.

| Box | Meaning  | Interval after a **correct** answer |
| --- | -------- | ----------------------------------- |
| 1   | learning | +1 day                              |
| 2   |          | +2 days                             |
| 3   |          | +4 days                             |
| 4   |          | +9 days                             |
| 5   |          | +21 days                            |
| 6   | mastered | +60 days (stays in box 6)           |

Transition rules:

- **Correct:** `box = min(box + 1, 6)`, `due_at = now + interval(new box)`.
- **Wrong:** `box = 1`, `due_at = now + 1 day` (and it may re-appear later in the
  same session — see "Re-queue on miss").
- `last_reviewed_at = now` on every answer.

Intervals are computed off the **new** box (the box the card lands in), measured
in whole days from "now". Day boundaries use the user's timezone (same
`profiles.timezone` the daily-cap logic already uses) so "due today" means due by
the user's local end-of-day.

## Daily session composition

When the user opens Review for a language, build a queue of **up to 15** cards:

1. **Due reviews** — words already introduced (`due_at` not null) with
   `due_at <= now`, oldest-due first. Take up to 15.
2. **New words** — if fewer than 15 due, fill the remainder with never-introduced
   words (`due_at is null`), oldest-created first. Introducing a new word means
   it gets graded this session and receives its first `due_at`.

If more than 15 are due, the overflow simply stays due and surfaces tomorrow
(no penalty). When the queue is empty, the Review screen shows an "All done for
today ✓" state.

**Re-queue on miss (within-session):** a card answered wrong is appended once to
the end of the current session queue so the user sees it again before finishing,
_in addition to_ its `due_at` being set to +1 day. This is the standard Leitner
"see it again today" behaviour and keeps a missed word from vanishing for a day.
The re-queue does not count against the 15 target (the 15 governs distinct
cards introduced/reviewed, not total reps).

## Migrating the existing 100+ words

Existing rows have `mastery` 0–3 and no schedule. On migration, seed the box
from mastery so progress isn't lost, but leave `due_at` null so they re-enter
gradually as "new" via the daily fill (no day-one pile of 100 due cards):

| old `mastery` | seed `srs_box` |
| ------------- | -------------- |
| 0             | 1              |
| 1             | 2              |
| 2             | 3              |
| 3             | 4              |

`due_at = null`, `last_reviewed_at = null` for all existing rows. They become the
"new" pool, introduced ~15/day; once introduced they follow the ladder normally.

## Data model

Migration `0020_vocab_srs.sql` (hand-written, additive, idempotent), adding to
`vocab_items`:

- `srs_box integer NOT NULL DEFAULT 1`
- `due_at timestamptz` (null = new / not yet introduced)
- `last_reviewed_at timestamptz`
- index `vocab_items_due_idx` on `(user_id, language, due_at)`

The Drizzle schema (`apps/api/src/db/schema/vocab-items.ts`) gains the matching
columns. `mastery` is **kept** (the existing deck "mastered ✓" checkmark and the
old PATCH path still compile); going forward `mastery` is treated as a derived
mirror of the box (`mastery = min(box - 1, 3)`) so existing UI keeps working
without a separate concept. (We do not remove `mastery` in this change to keep
the blast radius small.)

## API

All under the existing vocab routes (`apps/api/src/routes/vocab.ts`):

- `GET /v1/vocab/review/today?language=xx` → the day's queue and counts:
  ```json
  {
    "items": [VocabItem, ...],        // ≤ 15, due-first then new fill
    "dueCount": 8,                    // distinct due today (pre-cap)
    "newCount": 7,                    // new words in this queue
    "remainingTotal": 23              // due + new still ahead overall (for copy)
  }
  ```
- Recording an answer reuses the existing **pronounce** endpoint
  (`POST /v1/vocab/:id/pronounce`): instead of the old `mastery±`, it now applies
  the Leitner transition (advance/reset box, set `due_at`, `last_reviewed_at`,
  and mirror `mastery`). The manual `PATCH /v1/vocab/:id` `{result}` path applies
  the same transition so both graders stay consistent.
- `GET /v1/vocab` (deck list) unchanged in shape but its items now include
  `srs_box` / `due_at` so the deck list can show a small "due" / "learned" hint.

The Leitner transition is a **pure function** in a new module
(`apps/api/src/lib/srs.ts`): `nextSchedule({ box, correct, now, tz }) →
{ box, dueAt }`. Both the pronounce route and the PATCH route call it. This is
the single source of truth and the main unit-test target.

## Mobile UI

- **Home** (`apps/mobile/app/(tabs)/home.tsx` vocab card): show **"N words due
  today"** + a Review CTA, driven by `GET /v1/vocab/review/today` counts (or a
  lightweight count field). Falls back to the total-words copy when nothing is
  due ("You're all caught up").
- **Review** (`apps/mobile/app/vocab/review.tsx`): source the queue from
  `/review/today` (≤15) instead of `data.items.filter(mastery < 3)`. The
  flip / pronounce / manual-Next flow (incl. the recent BRU-28/16 changes) is
  unchanged. Add the "All done for today ✓" end state when the queue is empty.
- **Deck list** (`apps/mobile/app/vocab/index.tsx`): optional small per-row hint
  (e.g. "due" dot or "learned") from `srs_box`/`due_at`. Star toggle + source
  sentence + article display unchanged.
- **Starred "cram":** the existing starred-only review stays as an off-schedule
  practice mode; answers there still run through the same transition (a review is
  a review), so cramming a starred word also advances its schedule.

## Error handling / edge cases

- **No due + no new** → "All done for today ✓" (Review) and "caught up" (Home).
- **STT failure / silent audio** during pronounce → treated as an incorrect
  attempt (unchanged from today), i.e. the word drops to box 1.
- **Timezone missing** → fall back to UTC (same as the daily-cap code).
- **Empty deck** → existing "Nothing to review yet" state.
- New-word introduction is bounded only by the 15 target, so a fresh 100-word
  deck takes ~7 days of sessions to fully introduce — by design.

## Testing

- **`srs.ts` unit tests:** every box transition on correct/wrong; due-date math
  (intervals, timezone day boundary); box clamping at 6; mastery mirror.
- **`/review/today` route test:** due-first ordering, new fill to 15, the 15 cap
  with overflow left behind, counts correct, empty-queue case.
- **pronounce + PATCH route tests:** both apply the same transition (extend the
  existing vocab route tests / fake db to carry the new columns).
- **Migration:** applied via `pnpm db:migrate`; verify columns + index exist and
  existing rows seed the box from mastery with null `due_at`.

## Out of scope

- Push / notification reminders (→ BRU-21).
- Self-graded recall buttons / SM-2 quality scale.
- Per-user daily-target or interval settings (hardcoded for now).
- Removing or repurposing the legacy `mastery` column.
