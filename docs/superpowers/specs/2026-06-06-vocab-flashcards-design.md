# Vocabulary Flashcards — Design

**Date:** 2026-06-06
**Status:** Approved (design), pending implementation plan

## Goal

Let a learner review the vocabulary they actually used (and were taught) in
conversations, as a flashcard deck. Words flow in automatically from the
coach's end-of-session vocab extraction, and the learner can also save words
manually from a live transcript or add them by hand. Review is a simple
self-rated flip-card flow that tracks a sense of mastery.

## Non-goals (YAGNI)

- No full spaced-repetition scheduling (no due-dates / intervals). Mastery is a
  small integer counter, not an SRS algorithm.
- No audio/pronunciation in the flashcard flow for v1 (the term is text only;
  audio review can come later).
- No per-word tap detection inside message bubbles (RN can't do it reliably) —
  saving from a transcript uses long-press → an editable sheet.
- No new vocab tab. Entry is from Home.

## Data model

Reuse the existing `vocab_items` table as-is — **no migration**. Columns:
`id`, `userId`, `language`, `term`, `translation` (nullable),
`firstSeenMessageId` (nullable), `mastery` (int, default 0), `createdAt`.
Unique constraint on `(userId, language, term)`. RLS policy
`vocab_items_all_own` already grants full CRUD on own rows.

### Mastery model (self-rated)

- `mastery` is an integer 0–3.
- Review action `"got_it"` → `mastery = min(mastery + 1, 3)`.
- Review action `"still_learning"` → `mastery = 0`.
- A word is considered **learned** when `mastery >= 3`; **due** when
  `mastery < 3`.
- Deck and review order: `mastery asc, createdAt desc` (weakest words first).

## Backend — `/v1/vocab` routes

New route module `apps/api/src/routes/vocab.ts`, registered in `app.ts` under
`/v1`, following the existing Hono `{ Variables: { userId } }` pattern.

| Method & path          | Body / query                                                                 | Behavior                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/vocab`        | `?language=xx` (optional; defaults to caller's target language from profile) | Returns the user's deck for that language, sorted `mastery asc, createdAt desc`. Also returns a `dueCount` (items with `mastery < 3`).                                                                |
| `POST /v1/vocab`       | `{ language, term, translation? }`                                           | Manual add. If `translation` omitted, auto-translate `term` into the user's native language via the existing translate provider. Insert with `onConflictDoNothing`; return the row (existing or new). |
| `PATCH /v1/vocab/:id`  | `{ result: "got_it" \| "still_learning" }`                                   | Updates `mastery` per the model above. Scoped to the caller's own row. Returns the updated row.                                                                                                       |
| `DELETE /v1/vocab/:id` | —                                                                            | Removes the row (own rows only). Returns `{ ok: true }`.                                                                                                                                              |

All mutations use `.select()` / row-count checks so a silent RLS failure
surfaces as an error (per the Plan 5 lesson).

### Auto-persist hook

In the existing `/end` feedback job (`apps/api/src/routes/voice.ts`), after the
`session_feedback` row is updated with `fb.vocab`, upsert each extracted item
into `vocab_items`:

```
for each v in fb.vocab:
  insert vocab_items { userId, language: conversation.language,
                       term: v.term, translation: v.translation }
  onConflictDoNothing()   // dedupe on (userId, language, term)
```

`firstSeenMessageId` is left null (the extraction doesn't carry a message id).
This runs inside the existing fire-and-forget block; failures are swallowed so
they never block the `/end` response.

### One-time backfill

A standalone script (`apps/api/src/db/backfill-vocab.ts`, runnable like the
other `db/*.ts` scripts) walks existing `session_feedback` rows where
`status = 'ready'`, joins to `conversations` for `userId` + `language`, and
upserts each `vocab` entry into `vocab_items` with `onConflictDoNothing`. Idempotent
— safe to run more than once. Run once after deploy.

## Mobile — surfaces

API client functions in `apps/mobile/src/features/vocab/api.ts` and React Query
hooks in `apps/mobile/src/features/vocab/` (`use-vocab-deck`, `use-add-vocab`,
`use-review-vocab`, `use-remove-vocab`). All go through the existing authed
fetch wrapper; no direct fetches in components.

### Home entry

A "Review your words · N" card on `app/(tabs)/home.tsx` that routes to the deck.
`N` = `dueCount` from `GET /v1/vocab`. Hidden (or shows an empty-friendly state)
when the deck is empty. Styled with the existing design tokens / `EditorialText`.

### Deck screen — `app/vocab/index.tsx`

Stack/modal screen (not a tab). Contents:

- List of `term → translation` rows with a small mastery indicator (e.g. 0–3
  dots/pips).
- Swipe or long-press a row to **remove** (calls `DELETE`, optimistic update).
- **"+ Add word"** button → inline form / small sheet: `term` (required) +
  `translation` (optional; auto-filled server-side if blank), language defaults
  to current target language. Calls `POST`.
- **"Start review"** CTA → navigates to the review screen. Disabled when the
  deck is empty.

### Flashcard review — `app/vocab/review.tsx`

- Reviews the due subset (`mastery < 3`), least-mastered first; falls back to
  the whole deck if nothing is due.
- One card at a time: front shows `term`; tap to flip to `translation`
  (+ `source_phrase`/context if present).
- **"Still learning"** / **"Got it"** buttons record the result (`PATCH`) and
  advance. Optimistic; advance immediately.
- "Deck complete" summary at the end (count reviewed, how many marked got-it),
  with a button back to Home / deck.

### Save from transcript — `MessageBubble`

Long-press a message bubble in the live Practice screen opens a "Save to vocab"
bottom sheet:

- A `TextInput` prefilled with the bubble text, editable down to the word or
  phrase the learner wants.
- An auto-translated preview (reuses the translate path; debounced / on-blur).
- **Save** → `POST /v1/vocab` with the conversation's `language`. Toast/haptic
  confirmation; sheet closes.

Applies to both user and coach bubbles. Only the live conversation is wired
(there is no separate past-transcript viewer).

## Data flow

```
Conversation ends (/end)
  └─ feedback job extracts fb.vocab ──► session_feedback.vocab (existing)
                                   └──► vocab_items (NEW upsert)
Learner long-press bubble ─► sheet ─► POST /v1/vocab ─► vocab_items
Learner taps "+ Add word"  ───────► POST /v1/vocab ─► vocab_items
Home "Review your words" ─► GET /v1/vocab ─► deck screen ─► review screen
Review tap got_it/still_learning ─► PATCH /v1/vocab/:id (mastery)
Deck swipe-remove ─► DELETE /v1/vocab/:id
```

## Error handling

- Auto-persist and backfill failures are swallowed (never block `/end` or each
  other); reported via existing error reporting where the job already does.
- Manual add with a duplicate term returns the existing row (no error shown).
- Auto-translate failure on `POST` → store the term with `translation = null`;
  the UI shows the term alone (translation can be added later by editing — out
  of scope for v1, so null is acceptable).
- Mobile mutations are optimistic with rollback on error and a quiet retry/toast.

## Testing

- API: route tests for `vocab.ts` (list ordering + dueCount, add with/without
  translation, mastery transitions clamp at 0 and 3, delete scoping, RLS-scoped
  to own userId) following the existing `*.test.ts` pattern. A test that the
  `/end` job upserts into `vocab_items`.
- Backfill: a test that it's idempotent and dedupes.
- Mobile: no test runner is configured for components; verify by running the
  app (deck, add, remove, review flips + mastery, long-press save).

## Rollout

1. Backend routes + auto-persist hook + backfill script, with tests; deploy to
   Fly.
2. Run the backfill script once.
3. Mobile surfaces; verify on Bruno's device via a dev build.
4. Fold into the next production AAB.
