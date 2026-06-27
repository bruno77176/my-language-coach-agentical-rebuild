# Agentic Coach Memory (Pro-tier) — Design Spec

**Date:** 2026-06-27
**Status:** Approved (brainstorming → spec). Implementation plan tracked separately; rollout in layers (v1 = L1+L2).

## Problem / context

Today the coach's "memory" is a single `gpt-4o-mini` call at session end (`apps/api/src/lib/extract-memory.ts`, fire-and-forget from `apps/api/src/routes/voice.ts:994-1057`) that overwrites one structured JSON row per `(user, language)` in `coach_memory` (`apps/api/src/db/schema/coach-memory.ts`). That blob is injected as a `<context>` block (`packages/shared/src/prompts.ts:59-105`) next session. There is **no semantic recall, no full-history search, no edit history, no reasoning/planning loop** — a stateless extract → overwrite → inject.

We want a **deep, agentic memory layer** (recall + a tutor "brain" + persona continuity), **Pro-tier first**, by **extending the existing stack** (Supabase Postgres + pgvector, Hono/Fly API), with **hybrid timing**: heavy reasoning between sessions, a cheap semantic lookup live. Memory must be **curated, not noisy**.

## Chosen approach

**Approach A — Layered memory + a between-session digest agent.** Rejected: transcript-RAG (noisy, weak brain) and knowledge-graph memory (over-built before validation; a possible later evolution).

**Approved defaults:** embeddings = OpenAI `text-embedding-3-small` (1536-d); the between-session worker runs **in-process** in the Hono/Fly app (no separate service).

## How it sits on the existing code

- **Keep** `coach_memory` (structured profile) as the fast, always-injected layer — unchanged for free users.
- **Replace** the single `extract-memory.ts` call with a **durable digest job**.
- **Add** a curated semantic layer (`memory_items` + pgvector) + a lesson plan.
- **Extend** prompt injection (`prompts.ts`), `/v1/memory` endpoints (`apps/api/src/routes/memory.ts`), consent UI (`apps/mobile/app/(onboarding)/memory-consent.tsx` + Profile), and account-deletion cascade (`apps/api/src/routes/account-deletion.ts`).

## Design

### 1. Data model (hand-written numbered migration `0NNN_*.sql`, applied via `pnpm db:migrate`)

- **Enable `pgvector`** (`CREATE EXTENSION vector`).
- **`memory_items`**: `id uuid pk`, `user_id uuid`, `language_code text`, `type text` (`fact|mistake|preference|goal|persona_detail`), `content text`, `embedding vector(1536)`, `salience real default 0.5`, `status text default 'active'` (`active|archived`), `source_conversation_id uuid null`, SR fields `due_at timestamptz null` / `sr_interval_days int null` / `sr_ease real null`, `created_at/updated_at/last_seen_at`. **HNSW** index on `embedding`; btree on `(user_id,language_code,status)` and `(user_id,language_code,due_at)`. **RLS** `auth.uid() = user_id` with **both** USING and WITH CHECK (repo RLS gotcha).
- **`coach_memory`** gains `next_plan jsonb` + `next_plan_generated_at timestamptz`.
- **`digest_jobs`**: `id`, `user_id`, `conversation_id` (UNIQUE → idempotent), `language_code`, `status` (`pending|running|done|failed`), `attempts int`, `last_error text`, timestamps.
- New Zod schemas/types in `packages/shared` (memory item, lesson plan) alongside `CoachMemorySchema`.

### 2. Digest agent (between sessions)

Session-end inserts a `digest_jobs` row (returns fast). An **in-process worker** polls with `SELECT … FOR UPDATE SKIP LOCKED` (safe across ≥2 Fly machines), claims a job, runs:

1. **Extract** candidate memory items from the transcript (`gpt-4o-mini`, configurable).
2. **Embed** each candidate (`text-embedding-3-small`).
3. **Consolidate** — ANN-search existing active items of the same type within a similarity threshold; near-duplicate → bump `salience` + refresh `last_seen_at` (merge content) instead of inserting.
4. **Update** the structured profile (reuse today's extract logic).
5. **Schedule** SR for `mistake`/vocab items (SM-2-style).
6. **Plan** next lesson (`gpt-4o-mini`) → `{focus, target_structures, suggested_topics, callbacks}`; store on `coach_memory.next_plan`.

A **daily `pg_cron` decay sweep** lowers salience of stale items, archives below a floor, caps top-N per `(user,language)`. Idempotent on `conversation_id`; retried with backoff (`attempts` → `failed` + log).

### 3. Retrieval & injection

- **Session start** (`voice.ts:443-456`): structured profile + `next_plan` + **top-K memory items** = (highest salience) ∪ (SR `due_at <= now`) ∪ (persona details), token-budgeted, via extended `basicMemoryBlock`/`deepMemoryBlock` in `prompts.ts`.
- **Live (L4)**: per user message, a cheap pgvector lookup; one item above a high threshold surfaced as an ephemeral per-turn hint. Vector query only — no added reasoning latency.

### 4. Pro gating & cost

- **Free**: today's basic structured-profile block, unchanged — no embeddings, no digest. Flat cost.
- **Pro**: full digest + items + retrieval + plan + (L4) live lookup. Gate via existing `memoryDepth` plan check (`voice.ts:501-506`).
- **Cost/Pro session** ≈ two cheap `gpt-4o-mini` calls + embeddings (fractions of a cent), all between-sessions/batchable → no live-latency or per-turn cost impact. Models configurable ("never marry one model").

### 5. Privacy & consent

- Reuse `profiles.memory_enabled`: off → nothing written, no digest.
- Extend `/v1/memory` + Profile UI into a **"what your coach remembers"** list: view / edit / delete individual items + "forget everything."
- Extend account-deletion cascade to `memory_items`. Embeddings go via OpenAI (already the transcript processor — no new sub-processor); note in privacy policy.

### 6. Error handling

Failed digest → next session lacks newest items; **degrade to structured profile, never block a turn**. pgvector/embedding failures fall back the same way; items may be stored with `NULL` embedding and backfilled. All idempotent on `conversation_id`.

### 7. Testing

- **Unit**: extraction schema parsing, consolidation/dedup (mock embeddings), SR math, plan shape, retrieval ranking, token budgeting.
- **Integration** (CI Postgres container with pgvector): digest job end-to-end with mocked LLM/embeddings → assert items written/consolidated, plan stored, RLS isolation (A can't read B), injected block content. Test DB image needs pgvector.

## Layered rollout (each independently shippable)

- **L1 — Recall foundation** _(v1)_: migration; shared schemas; digest enqueue + in-process worker doing extract → embed → consolidate → update profile; session-start retrieval + injection; `/v1/memory` management + account-deletion cascade.
- **L2 — The brain** _(v1)_: SR scheduling + `next_plan` generation + plan injection.
- **L3 — Persona**: `persona_detail` items + callbacks (ties to BRU-23 "Lisa").
- **L4 — Live hybrid**: in-conversation vector lookup.

## Verification

- `pnpm -F @language-coach/api db:migrate` clean; `db:verify` shows new tables + pgvector.
- Unit tests pass; integration test drives a full digest end-to-end against CI Postgres+pgvector.
- Manual Pro session: `digest_jobs` row created → worker writes/consolidates `memory_items` → `coach_memory.next_plan` populated → next session's `<context>` block contains recalled items + plan.
- Free-tier path unchanged (no embeddings/digest); turns never block on digest/pgvector failure.
- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` green before push (feature branch).
