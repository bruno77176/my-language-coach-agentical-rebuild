# Scenario realism + coach-initiated dialog — design

**Date:** 2026-06-03
**Status:** Approved (brainstorming), pending implementation plan

## Problem

Two issues with role-play scenarios in the rebuilt app:

1. **The scenario conversations don't feel realistic.** The `systemPromptFragment`s
   in `role-play-scenarios.ts` are terse stage directions that read more like a
   QA checklist than a person. The model produces stilted, generic openings and
   over-eager "twists."
2. **The coach stays silent.** In scenario mode the client deliberately sends an
   empty message list and waits for the *user* to speak first
   (`use-conversation.ts:128-133`). In real life the barista / receptionist /
   officer greets *you*. Users expect the other person to open the dialog.

## Goals

- Each scenario's persona reads like a real person and **opens the conversation**.
- The coach speaks the first line of every scenario, generated live in character.
- The opener is **free**: it never checks or counts against the free-tier daily
  voice quota, and never triggers the paywall.
- No regression to free-conversation (Lisa) mode, which already greets the user.

## Non-goals

- A Lisa opener for free-conversation mode (she already greets).
- Static / precomputed opener audio. We accept the small first-line latency in
  exchange for a varied, natural opener every session.
- Reworking the SSE / audio-queue protocol. We reuse it as-is.

## Part 1 — Coach opens the dialog

### Backend: `POST /v1/voice/sessions/:id/opening`

A new route in `apps/api/src/routes/voice.ts`, alongside `/turns`.

Behavior:

1. Resolve `userId` from middleware; load the conversation and verify ownership
   (404 if not found / not owned).
2. **Guard — scenario only:** if `conversation.scenarioId` is null, return
   `400 BAD_REQUEST` ("opener is only for scenarios"). Free-conversation mode
   uses the existing Lisa greeting and must not hit this path.
3. **Idempotency guard:** if the conversation already has ≥1 message, emit a
   `done` event immediately and return — do not generate a second opener. Guards
   against a double client mount or a retry producing two opening lines.
4. Build the scenario system prompt via `buildCoachSystemPrompt({ ..., scenario })`
   (memory stays null in scenario mode, as today).
5. Call `streamChatCompletion` with **system-only** `promptMessages` (no history,
   no synthetic user turn). The model produces the opener because it is the first
   assistant turn.
6. Stream the result through the **same** per-sentence `reply-chunk` → TTS →
   `done` pipeline as `/turns` (reuse `SentenceBuffer`, `emitChunk`,
   `uploadCoachAudioChunk`). Insert one coach `messages` row with the full text;
   emit `done` with its `messageId`.
7. **Skip entirely:** transcription, user-message insert, quota check
   (`canUseSecondsDaily`), quota/usage increments, and `conversations.secondsSpoken`
   update. The opener costs the user nothing and is not gated.

`onUsage` is still wired so the coach TTS/LLM cost is attributed in the cost
dashboard (cost tracking ≠ user quota — we track spend but don't bill the user's
daily seconds).

### Client: `api-client.ts`

Add `streamOpening(conversationId): { events: AsyncIterable<TurnEvent>; close }`.
It mirrors `streamTurn` but:

- `POST`s to `/sessions/:id/opening` with **no body / no FormData**.
- Listens for the same `reply-chunk`, `done`, and `error` events (no
  `transcription` event is emitted by this endpoint, so that listener is omitted).

The `TurnEvent` union is reused unchanged.

### Client: `use-conversation.ts`

Replace the scenario branch (currently sets empty messages + `idle`) with an
opener flow:

1. After `startSession`, for a scenario set `phase: "processing"` (mic disabled —
   the user shouldn't talk over the greeting).
2. Call `streamOpening(conversation_id)` and consume events through the **same**
   reply-chunk / `AudioQueue` / `done` handling used by `stop()`. To avoid
   duplication, extract that event-consumption loop from `stop()` into a shared
   helper (e.g. `consumeCoachStream(events, { onTranscription? })`) used by both
   the opener and user turns. The opener passes no transcription handler.
3. On `done`, swap the client coach-message id to the server `messageId` (so
   repeat / translate hit a real row), drain the audio queue, then set `idle`.
4. **Soft failure:** on any opener `error` (or thrown), log it, leave `messages`
   empty, and set `idle` so the user can simply start speaking. The opener never
   shows the hard error screen.

The opener does **not** increment `userTurnCount` (it's a coach turn), so
session-eligibility logic is unaffected.

### Opener UX

While the opener is generating/playing, the mic is **disabled** (`processing`
phase). It enables once the opener finishes (`idle`), so the user replies after
the greeting — matching real conversation. (No barge-in.)

## Part 2 — Deeper, more realistic prompts

### `role-play-scenarios.ts`

Rewrite all 10 `systemPromptFragment`s. Each gains:

- A concrete persona: a first name and a specific setting detail.
- An explicit register (casual / polite-formal / assertive / professional).
- An explicit **"you speak first — open the way your character naturally would"**
  instruction (a greeting, a question, calling the student forward).
- Natural turn-taking: keep turns short, let the student lead, react to what they
  actually say rather than running a script.
- A realistic (not theatrical) twist where one already exists, framed as something
  that *might* come up rather than something to force.

Unchanged: `id`, `title`, `description`, `icon`, `pro` for every scenario. Still
10 scenarios, 3 free (coffee / directions / party), 7 pro.

### `prompts.ts` scenario block

Tighten the shared scaffolding in `buildCoachSystemPrompt`'s scenario branch:

- Add one line establishing the coach speaks first and responds to what the user
  actually says.
- Keep (and slightly sharpen) the existing guards: speak only the target
  language, stay in character, never teach / give grammar lessons / meta-comment,
  keep responses to 1–3 sentences, never reveal being an AI / Lisa / a coach.
- **Must not** inject the user's display name (the role-played stranger doesn't
  know it) — preserves the existing `not.toContain("Bruno")` test.

## Testing

Existing tests remain green by construction:

- `role-play-scenarios.test.ts`: 10 scenarios, 3 free, every fragment >40 chars,
  unique ids — all preserved.
- `prompts.test.ts`: scenario prompt still excludes "Bruno", "Your name is Lisa",
  "You are a kind, patient"; still includes the injected fragment text.

New backend test (mirroring the existing voice-route test harness):

- `/opening` happy path: scenario conversation → emits `reply-chunk`(s) + `done`
  with a real `messageId`; a coach `messages` row is inserted; **no** quota /
  `secondsSpoken` mutation occurs.
- `/opening` on a non-scenario conversation → `400`.
- `/opening` when messages already exist → immediate `done`, no second row.

## Affected files

- `app/apps/api/src/routes/voice.ts` — new `/opening` route (+ shared helper for
  the chunk/TTS pipeline if it cleanly factors out).
- `app/apps/api/src/routes/voice.test.ts` (or sibling) — new tests.
- `app/apps/mobile/src/lib/api-client.ts` — `streamOpening`.
- `app/apps/mobile/src/features/practice/use-conversation.ts` — opener flow +
  extracted `consumeCoachStream` helper.
- `app/packages/shared/src/role-play-scenarios.ts` — 10 rewritten fragments.
- `app/packages/shared/src/prompts.ts` — sharpened scenario scaffolding.
