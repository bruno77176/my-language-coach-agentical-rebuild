# Agentic Coach Memory — Build Status & Handoff (2026-06-27)

Autonomous build of the deep/agentic coach-memory feature (design: `docs/superpowers/specs/2026-06-27-agentic-coach-memory-design.md`). This doc is the human-readable summary; per-layer plans are in `docs/superpowers/plans/2026-06-27-coach-memory-*.md`.

## TL;DR

The complete **server-side** agentic memory system is built, reviewed, CI-green, and shipped as a **stack of PRs** (held, not merged). A prod outage caused by the L1a deploy was diagnosed and fixed. Everything that remains needs a **decision or device testing from Bruno**.

## What it does

Pro users get a coach that genuinely remembers and adapts:

- **Digest** (between sessions, in-process worker): extracts atomic memory items from each transcript → embeds (pgvector) → consolidates (dedup/bump salience) → writes `memory_items`. Pro-gated; free tier keeps its existing structured `coach_memory` untouched.
- **Brain**: after each digest, generates a next-lesson plan (`coach_memory.next_plan`) and seeds spaced-repetition on mistakes.
- **Retrieval/injection**: at session start, the top salient memory items + the lesson plan are injected into the coach prompt (deep tier only).
- **Management**: `/v1/memory/items` endpoints to list/delete what the coach remembers (privacy/GDPR); per-language delete wipes items too.
- **Cost-tracking**: digest OpenAI usage recorded to the cost ledger.

## Shipped PRs (stacked; HELD per "hold merges")

Merge order is bottom-up. The prod-migration gate is **resolved** (0022 is applied to prod), so these can merge whenever you want.

| PR         | Layer          | What                                                                                                                        |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **merged** | L1a            | data + lib foundation (migration 0022, schema, embeddings/extraction/consolidation libs). **Already on `main` + deployed.** |
| **#74**    | L1b-1          | digest pipeline + in-process worker (Pro-gated, next-tick retry)                                                            |
| **#75**    | L1b-2          | retrieval + injection (memory shapes conversations)                                                                         |
| **#76**    | L2             | the "brain" — SR seeding + lesson-plan generation + injection                                                               |
| **#77**    | L1b-3 (server) | `/v1/memory/items` management endpoints                                                                                     |
| **#78**    | hardening      | `cosineSimilarity` NaN guard + `GET /items` language validation                                                             |
| **#79**    | cost-tracking  | record Pro digest OpenAI usage                                                                                              |

Each was built TDD via subagents, per-task reviewed, and whole-branch reviewed. All CI-green (including a real pgvector integration test that runs the digest end-to-end).

## ⚠️ Prod incident (fixed)

Deploying L1a added `coach_memory.next_plan` to the Drizzle schema, but migration `0022` wasn't applied to prod (the Fly deploy doesn't run migrations). Drizzle's relational reads `SELECT` all schema columns, so every voice `/turns` read of `coach_memory` 500'd. **Fixed** by applying `0022` to prod (additive; pgvector 0.8.0 was available). Lesson saved to memory (`reference_deploy_migrate_ordering`).

## What needs YOU (not safely autonomous)

1. **Merge the stack** (#74→#75→#76→#77→#78→#79) when ready — this deploys the worker + retrieval to prod (safe now that 0022 is applied). Recommend merging bottom-up, or squash each in order.
2. **Auto-migrate-on-deploy** — add a `db:migrate` step to `.github/workflows/api-deploy.yml` so schema/DB can't drift again (prevents the incident class). Changes deploy behavior → your call.
3. **L4 — live in-conversation lookup** (not built): embed each user message + pgvector-search memory for a real-time callback. Adds an embedding call (~150ms) to every Pro turn — a **latency tradeoff** you care about, so I left it for you to decide.
4. **Mobile UI** (not built): the "what your coach remembers" screen (consumes the `/v1/memory/items` endpoints), tutor-persona UI, etc. — needs on-device testing.
5. **SR review/advance loop** (not built): advancing spaced-repetition intervals when a learner gets a past mistake right — needs design (in-conversation "got it right" signal).

## Minor follow-ups (non-blocking, recorded in reviews)

- `DELETE /items/:id` cross-user IDOR coverage would want an integration test (prod code is correct; the unit test only asserts the WHERE exists).
- `runPlanGeneration` does an extra `coachMemory.findFirst` for proficiency (could be passed in).
- Stranded `running` digest jobs have no reaper (add a requeue for `running` older than N min).
- Embedding-outage writes `NULL`-embedding items (won't vector-match later).
