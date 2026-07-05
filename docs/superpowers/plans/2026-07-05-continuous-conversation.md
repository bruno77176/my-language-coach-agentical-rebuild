# Continuous Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make free-form practice one continuous thread per language (WhatsApp-style) — reopening shows prior messages and continues with no greeting; feedback/memory/streak move from "session end" to a non-destructive checkpoint (manual "Wrap up" + auto on 30-min inactivity).

**Architecture:** The existing `conversations` row _is_ the thread (one per user+language, `scenario_id IS NULL`, `kind='thread'`). Messages accumulate on it forever; the LLM continues from that row's own history (already `slice(-20)`). A new `session_checkpoints` table slices the thread into feedback segments; `session_feedback` and `digest_jobs` gain a `checkpoint_id`. Role-play scenarios keep today's per-row `/end` path untouched.

**Tech Stack:** Hono + Drizzle (Supabase Postgres, custom numbered-SQL migration runner), Vitest; Expo SDK 54 + Expo Router + TanStack Query + Zustand; inline `StyleSheet`.

## Global Constraints

- Migrations: hand-written numbered SQL in `apps/api/src/db/migrations/0NNN_*.sql`, applied by the custom runner via `pnpm -F @language-coach/api db:migrate` (NOT drizzle-kit). Next number is `0021`.
- RLS: any new table needs RLS policies; UPDATE policies need BOTH `USING` and `WITH CHECK`. Verify mutations with a row-count/`.select()`.
- Mobile styling: inline `StyleSheet.create` only — never `className`.
- Keep CI green: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` from `app/` before every push. Watch CRLF.
- `apps/mobile` has no `eslint-plugin-react-hooks`: explain dep-array intent in prose, never a `react-hooks/exhaustive-deps` disable comment.
- Scenarios out of scope — do not change the scenario/`opening`/`/end` behavior for `kind='session'` rows.
- Config defaults: `INACTIVITY_CHECKPOINT_MINUTES=30`, `THREAD_HISTORY_PAGE_SIZE=30`.

---

### Task 1: DB migration — thread kind, checkpoints table, feedback/digest checkpoint keys

**Files:**

- Modify: `apps/api/src/db/schema/conversations.ts` (add `kind`)
- Create: `apps/api/src/db/schema/session-checkpoints.ts`
- Modify: `apps/api/src/db/schema/session-feedback.ts` (nullable `conversationId`, add `checkpointId`)
- Modify: `apps/api/src/db/schema/digest-jobs.ts` (add `checkpointId`)
- Modify: `apps/api/src/db/schema/index.ts` (export session-checkpoints)
- Create: `apps/api/src/db/migrations/0021_continuous_conversation.sql`

**Interfaces:**

- Produces: `conversations.kind` (`'session'|'thread'`), table `session_checkpoints`, `sessionCheckpoints` drizzle table, `sessionFeedback.checkpointId`, `digestJobs.checkpointId`.

- [ ] **Step 1: Drizzle schema — conversations.kind**

In `conversations.ts` add to the table columns:

```ts
kind: text("kind").notNull().default("session"), // 'session' | 'thread'
```

- [ ] **Step 2: Drizzle schema — session_checkpoints**

Create `apps/api/src/db/schema/session-checkpoints.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { profiles } from "./profiles";

export const sessionCheckpoints = pgTable(
  "session_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userEndedIdx: index("checkpoints_user_ended_idx").on(
      t.userId,
      t.endedAt.desc(),
    ),
  }),
);
export type SessionCheckpoint = typeof sessionCheckpoints.$inferSelect;
export type NewSessionCheckpoint = typeof sessionCheckpoints.$inferInsert;
```

Export it from `schema/index.ts`.

- [ ] **Step 3: Drizzle schema — session_feedback + digest_jobs**

`session-feedback.ts`: make `conversationId` nullable (drop `.primaryKey()`), add `checkpointId`:

```ts
conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
checkpointId: uuid("checkpoint_id").references(() => sessionCheckpoints.id, { onDelete: "cascade" }),
```

(Import `sessionCheckpoints`.) `digest-jobs.ts`: add `checkpointId: uuid("checkpoint_id").references(() => sessionCheckpoints.id, { onDelete: "cascade" })` (nullable).

- [ ] **Step 4: Hand-written migration SQL**

Create `0021_continuous_conversation.sql`. Model RLS policies on the existing `0018`/conversations policies (same `auth.uid() = user_id` shape). Include:

```sql
-- conversations.kind
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'session';
-- one thread per (user, language)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_thread_per_lang
  ON conversations (user_id, language) WHERE kind = 'thread';

-- checkpoints
CREATE TABLE IF NOT EXISTS session_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  seconds_spoken integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkpoints_user_ended_idx ON session_checkpoints (user_id, ended_at DESC);
ALTER TABLE session_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_checkpoints_select ON session_checkpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY session_checkpoints_insert ON session_checkpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
-- (service-role bypasses RLS; policies are defense-in-depth like the other tables)

-- session_feedback: drop PK on conversation_id, make nullable, add checkpoint_id
ALTER TABLE session_feedback DROP CONSTRAINT IF EXISTS session_feedback_pkey;
ALTER TABLE session_feedback ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE session_feedback ADD COLUMN IF NOT EXISTS checkpoint_id uuid REFERENCES session_checkpoints(id) ON DELETE CASCADE;
-- keep scenario/legacy rows 1:1 on conversation_id (NULLs are distinct in PG, so thread rows with NULL conv_id don't collide)
CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_conversation_uniq ON session_feedback (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_feedback_checkpoint_uniq ON session_feedback (checkpoint_id) WHERE checkpoint_id IS NOT NULL;

-- digest_jobs: allow keying on checkpoint
ALTER TABLE digest_jobs ADD COLUMN IF NOT EXISTS checkpoint_id uuid REFERENCES session_checkpoints(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS digest_jobs_checkpoint_uniq ON digest_jobs (checkpoint_id) WHERE checkpoint_id IS NOT NULL;
```

Check the existing `digest_jobs` unique/onConflict target first (read `digest-jobs.ts`) and mirror its RLS style.

- [ ] **Step 5: Typecheck + apply locally is N/A (no local PG). Verify schema compiles**

Run: `pnpm -F @language-coach/api typecheck`
Expected: PASS. (Migration is applied to prod in the deploy phase, not here.)

- [ ] **Step 6: Commit** — `feat(api): schema + migration for continuous-conversation threads & checkpoints`

---

### Task 2: API — extract shared `runCheckpoint()` from `/end`

Refactor the memory-extract + feedback-generate + streak logic so both `/end` (scenarios) and the new `/checkpoint` (threads) reuse it over an arbitrary message range.

**Files:**

- Create: `apps/api/src/routes/checkpoint.ts` (pure helper, no Hono)
- Modify: `apps/api/src/routes/voice.ts` (call the helper from `/end`)
- Test: `apps/api/src/routes/checkpoint.test.ts`

**Interfaces:**

- Produces:

```ts
export type RunCheckpointArgs = {
  db: Database;
  deps: Pick<VoiceDeps, "extractMemory" | "generateFeedback">;
  userId: string;
  conversationId: string;
  language: string;
  nativeLang: string;
  memoryEnabled: boolean;
  timezone: string;
  since: Date | null; // segment start; null = whole conversation
  checkpointId: string | null; // null → key feedback/digest on conversationId (scenario/legacy)
  platform: string | null;
  now: Date;
  dailyGoalSeconds: number;
};
export async function runCheckpoint(
  a: RunCheckpointArgs,
): Promise<{ secondsSpoken: number; goalReached: boolean }>;
```

- Consumes: `messages`, `sessionFeedback`, `coachMemory`, `digestJobs`, `streak_days` (raw SQL), `persistVocab`.

- [ ] **Step 1: Write failing unit test** for `runCheckpoint` with a fake db recording calls: assert it (a) filters transcript by `since`, (b) inserts a feedback row keyed by `checkpointId` when set / by `conversationId` when null, (c) calls `extractMemory` with the range-scoped transcript, (d) returns `secondsSpoken`. Use small in-memory fakes for the drizzle query builders used (mirror the pattern in existing `voice`/`generate-feedback` tests).
- [ ] **Step 2: Run — FAIL** (`pnpm -F @language-coach/api test checkpoint`)
- [ ] **Step 3: Implement `runCheckpoint`** — lift lines `voice.ts:1010-1158` (memory extract + feedback insert/generate + persistVocab) and the streak upsert (`:986-995`) into the helper. Transcript query gains `since`: `where conversationId = … AND (since IS NULL OR createdAt > since)`. Feedback insert/update keys on `checkpointId ?? conversationId` (build the `where`/`values` accordingly). Digest enqueue includes `checkpointId`. Streak uses `secondsSpoken` passed in.
- [ ] **Step 4: Rewire `/end`** to compute `since=null`, `checkpointId=null`, `secondsSpoken=wall-clock(startedAt→now)` and call `runCheckpoint`. Keep the `endedAt`/`secondsSpoken` update + idempotency + onboarding-push scheduling in the route. Behavior for scenarios unchanged.
- [ ] **Step 5: Run tests — PASS**; then `pnpm -F @language-coach/api typecheck`.
- [ ] **Step 6: Commit** — `refactor(api): extract runCheckpoint shared by /end and /checkpoint`

---

### Task 3: API — thread resolution, `/checkpoint` route, inactivity auto-checkpoint, pagination

**Files:**

- Modify: `apps/api/src/routes/voice.ts`
- Modify: `apps/api/src/env.ts` (add `INACTIVITY_CHECKPOINT_MINUTES`, `THREAD_HISTORY_PAGE_SIZE`)
- Test: `apps/api/src/routes/voice.thread.test.ts`

**Interfaces:**

- Consumes: `runCheckpoint` (Task 2), `sessionCheckpoints`, `conversations.kind`.
- Produces routes: `POST /sessions` free-form returns `{ conversation_id, kind, is_new_thread, messages, has_more, ...caps }`; `POST /sessions/:id/checkpoint`; `GET /sessions/:id/messages?before&limit`.

- [ ] **Step 1: env constants** — add to `env.ts` schema with defaults 30 and 30.
- [ ] **Step 2: Failing test** — free-form `POST /sessions` twice for same (user, language) returns the SAME `conversation_id` and `kind:'thread'`; first call `is_new_thread:true`, second `false`; second returns prior `messages`. Scenario `POST /sessions` still creates a fresh row. (Integration-style test in the harness used by existing voice tests; if those are integration-only/skipped locally, add a focused unit test around a `resolveThread(db,userId,language)` helper instead and mark integration coverage as CI-provided.)
- [ ] **Step 3: Implement `resolveThread`** helper: `SELECT … WHERE user_id AND language AND kind='thread'`; if none, insert `kind='thread'` (catch unique-violation → re-select, for the race). Return the row.
- [ ] **Step 4: Rewire `POST /sessions`** — when `scenario_id` absent: `resolveThread`, then **auto-checkpoint if stale** (see Step 6), then load last `THREAD_HISTORY_PAGE_SIZE` messages (desc, reversed to asc) + `has_more`; return them with `is_new_thread = (message count === 0 at resolve time)`. Keep the daily-cap 429 gate and the cap fields exactly as today. When `scenario_id` present: unchanged path (fresh `kind='session'` row).
- [ ] **Step 5: `POST /sessions/:id/checkpoint`** — ownership check; find last checkpoint's `ended_at` for this conversation (`since`); if no un-checkpointed messages since `since`, return `{ checkpoint_id:null, seconds_spoken:0, goal_reached:false }` (no-op). Else insert a `session_checkpoints` row (`started_at=since ?? conversation.startedAt`, `ended_at=now`, `seconds_spoken=now-start`), call `runCheckpoint({…, since, checkpointId})`, do NOT set `endedAt`. Return `{ checkpoint_id, seconds_spoken, goal_reached }`.
- [ ] **Step 6: Inactivity auto-checkpoint** — factor Step 5's body into `maybeCheckpoint(db,deps,thread,{force})`. In `POST /sessions`, after resolveThread: find newest message; if it exists and `now - newest.createdAt > INACTIVITY_CHECKPOINT_MINUTES*60000` and there are un-checkpointed messages, run `maybeCheckpoint(force:true)` before returning. Idempotent when nothing stale.
- [ ] **Step 7: Pagination** — `GET /sessions/:id/messages` accepts `?before=<ISO>&limit=<n>`; when `before` set, filter `createdAt < before`, order desc, take `limit`, reverse to asc, return `{ messages, has_more }`.
- [ ] **Step 8: Tests PASS + typecheck.**
- [ ] **Step 9: Commit** — `feat(api): per-language conversation threads + checkpoint route + inactivity auto-checkpoint`

---

### Task 4: API — recents & transcript by checkpoint

**Files:** Modify `apps/api/src/routes/voice.ts`; Test `apps/api/src/routes/voice.recent.test.ts`

- [ ] **Step 1: Failing test** — `GET /sessions/recent` returns recent **checkpoints** (id, ended_at, seconds_spoken, feedbackStatus) for the user, newest first, limit 5; still includes legacy scenario `/end` sessions (union or a compatible shape). Transcript endpoint for a checkpoint returns messages within `[started_at, ended_at]`.
- [ ] **Step 2: Implement recents** — query `session_checkpoints` joined to `session_feedback` on `checkpoint_id` for status; keep the existing ended-conversation query for scenarios and merge (order by ended_at desc, limit 5). Response items gain `kind` + a stable `id` the client opens (`checkpoint_id` or `conversation_id`).
- [ ] **Step 3: Transcript by checkpoint** — extend `GET /sessions/:id/messages` (or a `?checkpoint_id=` variant) so a checkpoint id resolves to its thread + `[started_at, ended_at]` range. Reuse ownership checks.
- [ ] **Step 4: Tests PASS + typecheck.**
- [ ] **Step 5: Commit** — `feat(api): recents & transcript keyed on checkpoints`

---

### Task 5: Mobile — thread load, no re-greeting, pagination

**Files:**

- Modify: `apps/mobile/src/lib/api-client.ts` (thread-shaped `startSession` response, `checkpointSession`, paginated messages)
- Modify: `apps/mobile/src/features/practice/use-conversation.ts`
- Modify: `apps/mobile/app/(tabs)/practice.tsx` (wrap-up wiring)
- Test: `apps/mobile/src/features/practice/*.test.ts(x)` where practice hooks are tested

**Interfaces:**

- Consumes: Task 3 responses. Produces: hook returns `loadEarlier()`, `wrapUp()`.

- [ ] **Step 1: api-client** — extend `startSession` to return `{ conversation_id, is_new_thread, messages, has_more, ...caps }`; add `checkpointSession(conversationId)` → `{ checkpoint_id, seconds_spoken, goal_reached }`; add `fetchMessages(conversationId, before?)`.
- [ ] **Step 2: use-conversation session-start effect** (`:152-247`) — seed `messages` from `session.messages` (map to `ChatMessage`, mark greeting rows via `isGreeting`). **Greeting only when `is_new_thread`** — otherwise skip greeting text + audio entirely. Keep the 429→limit redirect and daily-cap publish. Scenario path unchanged.
- [ ] **Step 3: `loadEarlier`** — expose a callback that fetches older messages via `fetchMessages(id, oldestLoadedCreatedAt)` and prepends; track `hasMore`.
- [ ] **Step 4: `wrapUp`** — new fn calling `checkpointSession`; on success navigate to end-of-session/feedback for `checkpoint_id` WITHOUT unmounting the thread (so returning keeps messages, no re-greet). Rename the End action in `practice.tsx` to "Wrap up & get feedback"; keep discard/leave as a separate non-feedback exit.
- [ ] **Step 5: Tests** for the practice hook (greeting suppressed when history present; wrapUp calls checkpoint) PASS; `pnpm -F @language-coach/mobile typecheck`.
- [ ] **Step 6: Commit** — `feat(mobile): continuous thread — load history, suppress re-greeting, wrap-up checkpoint`

---

### Task 6: Mobile — recents & transcript by checkpoint + "load earlier" UI

**Files:** Modify `apps/mobile/src/features/practice/use-recent-sessions.ts`, `use-conversation-transcript.ts`, `app/(tabs)/practice.tsx`, `app/(modals)/transcript.tsx`, the practice message list.

- [ ] **Step 1:** Point recents at the checkpoint-shaped response; row tap opens the transcript by the item's `id`/`checkpoint_id`.
- [ ] **Step 2:** Transcript modal loads the checkpoint's ranged messages.
- [ ] **Step 3:** Add a "Load earlier messages" affordance at the top of the practice transcript calling `loadEarlier()` when `hasMore`.
- [ ] **Step 4:** `pnpm -F @language-coach/mobile typecheck` + any hook tests PASS.
- [ ] **Step 5: Commit** — `feat(mobile): recents/transcript by checkpoint + load-earlier`

---

### Task 7: Full CI gate + spec coverage sweep

- [ ] From `app/`: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` — all green.
- [ ] Re-read the spec; confirm each locked decision has a task. Fix gaps inline.
- [ ] Commit any format fixes.

---

### Task 8: Release (prod) — migration, PR, merge, deploy, verify

- [ ] Apply additive migration to prod: `pnpm -F @language-coach/api db:migrate` then `pnpm -F @language-coach/api db:verify`. (Additive → safe before new code deploys.)
- [ ] Push branch, open PR (gh), run an adversarial code review, address findings.
- [ ] Merge to `main` → API auto-deploys (Fly). Poll `curl https://my-language-coach-agentical-rebuild.fly.dev/health` → 200 and spot-check a thread `POST /sessions`.

---

### Task 9: Mobile builds

- [ ] Bump `ios.buildNumber "51"→"52"` and `android.versionCode 87→88` (keep `version "2.0.3"` per the freeze policy — internal testing needs no re-review).
- [ ] `eas build --platform android --profile production --non-interactive` and `--platform ios` (check `eas.json` profile names first).
- [ ] Poll `eas build:list --json` (status UPPERCASE `FINISHED`). Report build URLs.
- [ ] Notify Bruno: builds ready to submit + test.

## Self-review notes

- Spec coverage: thread unit (T3), no re-greet (T5), checkpoint model (T2/T3), inactivity 30m (T3), wrap-up button (T5), scenarios untouched (T2/T3 guard on `scenario_id`/`kind`), recents/transcript (T4/T6), digest & feedback checkpoint keys + `session_feedback` PK migration (T1), quotas untouched (T3 keeps the gate).
- The `session_feedback` nullable-conversation_id + partial-unique-index design keeps the currently-deployed `/end` insert working during the deploy window (NULLs distinct; scenario rows still 1:1).
