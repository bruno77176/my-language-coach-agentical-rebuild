# Feedback Retry Button — Design

**Date:** 2026-07-10
**Status:** Approved (pending spec review)

## Problem

When post-session feedback generation returns `null`, the `session_feedback`
row is marked `failed` and the end-of-session screen shows a dead end:
"Couldn't generate feedback this session. No worries — try another conversation."
There is no way to recover that report — the session's transcript still exists,
but the user permanently loses feedback for a conversation they actually had.

The underlying generator was just hardened (retry + fallback + lenient parse, see
`generate-feedback.ts`), which should make new failures rare. This feature adds
the missing **recovery path** for the failures that still slip through, and
retroactively rescues already-`failed` rows (which the generator hardening does
not touch).

## Goals

- A "Try again" button on the failed feedback screen that regenerates the report.
- Regeneration reproduces the **same** conversation segment the failed report was
  for — not newer thread messages accumulated since.
- Recover existing `failed` rows with no migration/script (open via Recent → tap).

## Non-goals

- No auto-retry on open (manual button only, per product decision).
- Does **not** re-run coach-memory extraction or the between-session digest — this
  regenerates only the feedback report. Those side effects aren't the failure and
  may already have run for the segment.
- No new retry-count limit beyond the natural gate (only `failed` rows can be
  retried; `pending`/`ready` are no-ops).

## Backend

Two endpoints, added to `apps/api/src/routes/feedback.ts` (mirroring the existing
GET routes and their ownership checks):

- `POST /v1/sessions/:id/feedback/retry` — scenario/legacy rows (checkpoint_id NULL)
- `POST /v1/checkpoints/:id/feedback/retry` — continuous-thread rows

Each handler:

1. **Ownership check** — the conversation (by `id` + `userId`) or the checkpoint
   (by `id` + `userId`). 404 if not owned/found — identical to the GET routes.
2. **Locate the row** — the `session_feedback` row keyed on `checkpointId`
   (checkpoint route) or on `conversationId` + `checkpoint_id IS NULL` (session
   route).
3. **Status gate:**
   - `missing` (no row) → `404` (nothing was ever attempted; wrap-up never ran).
   - `ready` → `200 { status: "ready", … }` (already recovered; no-op).
   - `pending` → `202 { status: "pending" }` (in-flight; no-op, avoids double-fire).
   - `failed` → proceed to step 4.
4. **Flip to `pending`**, verified with a row-count check (RLS gotcha: UPDATE must
   affect a row). Return **`202 { status: "pending" }`** immediately.
5. **Regenerate in the background** (`void (async () => { … })()`, the same
   fire-and-forget pattern `maybeCheckpoint` uses; Fly machines are long-running):
   - Build the transcript for the segment:
     - **Checkpoint route:** messages with `conversationId = conv` AND
       `createdAt >= checkpoint.startedAt` AND `createdAt <= checkpoint.endedAt`.
       The stored bounds reproduce the original sitting even if the thread has
       grown since.
     - **Session route:** all messages for the conversation (matches the original
       scenario/legacy `/end` behavior).
   - Resolve `languageCode` (conversation.language) and `nativeLanguageCode`
     (profile.nativeLanguage) — the same inputs `runFeedbackAndMemory` uses.
   - Call `generateFeedback(...)`.
   - On success → UPDATE the row to `status: "ready"` + highlights/corrections/vocab,
     then `persistVocab(...)` (dedup-safe, matching the original happy path).
   - On `null` → UPDATE the row back to `status: "failed"`.
   - Wrap in try/catch → `reportError({ where: "feedback.retry" })`, then leave the
     row `failed`. Never throws to the client (the 202 already returned).

The regenerate logic (build transcript for the range → `generateFeedback` →
update the row → `persistVocab`) lives in **one** helper,
`regenerateFeedback(db, deps, { userId, conversationId, checkpointId, language,
nativeLang, platform, range })`, called by both route handlers. The route handlers
own only the ownership check, the status gate, the flip-to-`pending`, and the
`range` selection (checkpoint bounds vs whole conversation).

### Empty-transcript edge case

If the segment's messages were deleted, the transcript is empty; `generateFeedback`
will return an empty-but-valid report and the row becomes `ready` with empty
sections. Acceptable — it's indistinguishable from "nothing to say" and strictly
better than a permanent dead end. Not special-cased.

## Frontend

`apps/mobile/app/(modals)/end-of-session.tsx`, `status === "failed"` block:

- Keep the reassuring copy; add a primary **"Try again"** button below it.
- New hook `use-retry-feedback.ts` (TanStack `useMutation`, matching the existing
  `use-*-mutations` pattern and `api-client` auth headers):
  - `mutationFn` POSTs to `/v1/checkpoints/:id/feedback/retry` or
    `/v1/sessions/:id/feedback/retry` based on the `kind` the screen already knows.
  - `onMutate` / `onSuccess`: `queryClient.setQueryData(["session-feedback", kind,
id], { status: "pending" })`. This restarts the existing `refetchInterval`
    (which polls while `pending`), so the "Your coach is preparing feedback…"
    spinner shows and the screen auto-updates to `ready`/`failed`.
  - `onError`: surface a lightweight inline message; leave the button tappable.
- The button is disabled while the mutation is in flight or while status is
  `pending`, to prevent spamming.

No change to `use-session-feedback.ts` polling — the `pending` state already drives
it.

## Recovery of existing failed rows

Both current `failed` rows (the 7m18s thread checkpoint and the interview session)
are reachable through Recent → feedback, which routes into `end-of-session.tsx`
with the right `conversationId`/`checkpointId`. Opening either and tapping "Try
again" regenerates it. No backfill script needed.

## Testing

- **API unit/route tests** (`feedback.test.ts`):
  - `failed` → 202 + row flips to `pending`, then (mocked generate) → `ready`.
  - `ready` → 200 no-op; `pending` → 202 no-op; `missing` → 404.
  - Ownership: another user's conversation/checkpoint → 404.
  - Checkpoint route bounds the transcript to `[startedAt, endedAt]` (a newer
    message outside the window is excluded).
  - Regeneration failure → row returns to `failed`.
- **Generator** already covered by `generate-feedback.test.ts`.
- Mobile hook: covered by manual verification (the app has no RN test harness for
  screens); typecheck + the existing lint gates apply.

## Rollout

Backend + mobile ship together. Backend auto-deploys on push (apps/api change).
Mobile ships in the next EAS build; the button is additive and safe with the
already-deployed generator hardening.
