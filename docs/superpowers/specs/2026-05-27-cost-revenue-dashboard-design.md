# Cost & Revenue Dashboard — Design

**Date:** 2026-05-27
**Status:** Approved for planning
**Author:** Bruno + Claude (brainstorming session)

## Why

Bruno is heading into Plan 8 (engagement + monetization + freemium). Setting freemium prices without unit-cost data is guesswork. A cost/revenue dashboard built **before** Plan 8 ships gives him:

1. **Unit economics for pricing** — actual $/active-user across OpenAI, Deepgram, ElevenLabs, Google TTS, Fly, Supabase. Required to set the free-tier ceiling and Pro price.
2. **Real-time visibility** during beta — early warning if a single user is consuming disproportionate resources, or if a provider price change is bleeding the budget.
3. **Phase-2 foundation** — when Plan 8 lands subscriptions and ads, the `revenue_events` table is already in place. No second migration round.

This is also the only place where iOS-vs-Android cost/revenue comparisons can live, which Bruno called out as important.

## Scope

### In this plan

- Postgres schema for usage events, rate cards, fixed costs, upfront costs, and an empty revenue scaffold.
- Instrumentation wrappers around every paid provider call (OpenAI, Deepgram, ElevenLabs, Google TTS, and any future paid provider).
- Admin API endpoints (`/admin/*`) that aggregate the above, filterable by date / platform / service / user.
- Admin Next.js app (`apps/admin/`) deployed to Vercel — 4 pages: Dashboard, Users, Services, Settings.
- Supabase magic-link auth gated by an `ADMIN_USER_IDS` allowlist on both client and server.
- Rate-card seeding script with current prices for all models/operations in use today.
- Materialized view `daily_cost_by_user` refreshed every 5 minutes.

### Explicitly deferred

- Revenue dashboard UI (panels added when Plan 8 ships subscriptions/ads — the `revenue_events` table exists from day 1 so no migration is needed then).
- Monthly invoice reconciliation. **Bruno flagged this as a wanted Phase 2 feature** — paste/upload the real invoice each month, store as `actual_cost`, dashboard surfaces estimate-vs-actual variance.
- Threshold alerts (e.g. "ping me if daily cost > $X").
- CSV/PDF export.
- Provider price auto-sync.
- Multi-currency support (USD only).

## Architecture

Four pieces, each with one clear job:

1. **Instrumentation layer** — thin wrapper inside `apps/api/src/providers/` that captures every paid provider call and writes one `usage_events` row.
2. **Rate-card store** — Postgres tables (`rate_cards`, `fixed_costs`, `upfront_costs`) edited via admin UI.
3. **Admin API** — new `/admin/*` routes in `apps/api`, gated by `requireAdmin` middleware, returning JSON aggregates filtered by query params.
4. **Admin web app** — new `apps/admin/` (Next.js 14 app router + Tailwind + Recharts + TanStack Query). Auth via Supabase magic link + allowlist. Hosted on Vercel free tier.

**Data flow:** provider call → fire-and-forget insert into `usage_events` → admin endpoints aggregate via materialized view → admin app renders with filters from URL state.

## Data model

Five new Postgres tables (Drizzle schema in `apps/api/src/db/schema/`):

### `usage_events` (the fact table — one row per paid API call)

| Column            | Type                            | Notes                                                                                 |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `id`              | uuid PK                         |                                                                                       |
| `created_at`      | timestamptz                     | indexed                                                                               |
| `user_id`         | uuid, FK profiles, **nullable** | null = non-user-attributable (cron, health checks)                                    |
| `platform`        | text                            | `'ios' \| 'android' \| 'web' \| 'server' \| 'unknown'`                                |
| `provider`        | text                            | `'openai' \| 'deepgram' \| 'elevenlabs' \| 'google_tts' \| 'supabase'`                |
| `operation`       | text                            | e.g. `'chat'`, `'transcribe'`, `'tts'`, `'translate'`                                 |
| `units`           | numeric                         | quantity billed                                                                       |
| `unit_type`       | text                            | `'input_tokens' \| 'output_tokens' \| 'seconds' \| 'characters' \| 'requests'`        |
| `cost_usd`        | numeric(10,6)                   | **snapshotted at write time** from current rate card — historical events never change |
| `rate_card_id`    | uuid FK                         | which row priced this event                                                           |
| `conversation_id` | uuid, nullable                  | for drill-in by conversation                                                          |
| `meta`            | jsonb                           | room for `model`, `voice_id`, etc.                                                    |

Indexes: `(created_at)`, `(user_id, created_at)`, `(provider, created_at)`, `(platform, created_at)`.

### `rate_cards` (versioned pricing)

| Column           | Type                  | Notes                                          |
| ---------------- | --------------------- | ---------------------------------------------- |
| `id`             | uuid PK               |                                                |
| `provider`       | text                  |                                                |
| `operation`      | text                  |                                                |
| `unit_type`      | text                  |                                                |
| `price_per_unit` | numeric               | USD per single unit                            |
| `effective_from` | timestamptz           |                                                |
| `effective_to`   | timestamptz, nullable | null = still active                            |
| `notes`          | text, nullable        | e.g. "OpenAI announced new pricing 2026-05-15" |

Unique constraint: `(provider, operation, unit_type, effective_from)`. Lookup at write time: most recent row where `effective_from <= now() AND (effective_to IS NULL OR effective_to > now())`.

### `fixed_costs` (recurring infra)

| Column       | Type           | Notes                                             |
| ------------ | -------------- | ------------------------------------------------- |
| `id`         | uuid PK        |                                                   |
| `service`    | text           | `'fly' \| 'supabase' \| 'vercel' \| 'eas' \| ...` |
| `amount_usd` | numeric        |                                                   |
| `period`     | text           | `'monthly' \| 'yearly'`                           |
| `started_on` | date           |                                                   |
| `ended_on`   | date, nullable | null = ongoing                                    |
| `notes`      | text, nullable |                                                   |

Pro-ration: shown amount for a date window = (amount per day from `period`) × overlapping days between `[started_on, ended_on)` and the window.

### `upfront_costs` (one-time / yearly memberships)

| Column            | Type           | Notes                                                                 |
| ----------------- | -------------- | --------------------------------------------------------------------- |
| `id`              | uuid PK        |                                                                       |
| `label`           | text           | e.g. `'Apple Developer 2026'`, `'Play Store registration'`            |
| `amount_usd`      | numeric        |                                                                       |
| `paid_on`         | date           |                                                                       |
| `amortize_months` | int, nullable  | null = full hit on `paid_on`; 12 = $X/month for a year from `paid_on` |
| `notes`           | text, nullable |                                                                       |

### `revenue_events` (scaffold — empty until Plan 8)

| Column        | Type        | Notes                                          |
| ------------- | ----------- | ---------------------------------------------- |
| `id`          | uuid PK     |                                                |
| `created_at`  | timestamptz |                                                |
| `user_id`     | uuid FK     |                                                |
| `platform`    | text        |                                                |
| `source`      | text        | `'subscription' \| 'iap' \| 'ads'`             |
| `amount_usd`  | numeric     | net of provider fees, where known              |
| `currency`    | text        | original transaction currency for traceability |
| `provider`    | text        | `'stripe' \| 'revenuecat' \| 'admob'`          |
| `external_id` | text        | provider transaction ID                        |
| `meta`        | jsonb       |                                                |

RLS on all five tables: admin allowlist can SELECT; service role can INSERT; nobody else.

### Materialized view

```sql
CREATE MATERIALIZED VIEW daily_cost_by_user AS
SELECT
  date_trunc('day', created_at) AS day,
  user_id,
  platform,
  provider,
  operation,
  SUM(units) AS units,
  SUM(cost_usd) AS cost_usd,
  COUNT(*) AS event_count
FROM usage_events
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX ON daily_cost_by_user (day);
CREATE INDEX ON daily_cost_by_user (user_id, day);
CREATE INDEX ON daily_cost_by_user (provider, day);
```

Refreshed every 5 minutes via Supabase scheduled function.

## Cost computation rules

**Variable per-call costs.** Provider wrapper, after the call succeeds, looks up the active `rate_cards` row for `(provider, operation, unit_type)` and writes `cost_usd = units × price_per_unit` into the event. Never recomputed.

**Fixed recurring costs.** Shown amount for a date range = pro-rated days inside the range. Cancelled services use `ended_on`.

**Upfront costs.** If `amortize_months IS NULL` → full amount on `paid_on`. Else → spread evenly over N months from `paid_on`.

**Per-user attribution.**

- Variable costs → `usage_events.user_id` (null = "unattributed" bucket).
- Fixed + upfront costs → **never** force-allocated to users. They appear in totals and a dedicated "Infrastructure" card.
- "Cost per active user" is a derived metric = total spend ÷ active users in period. Computed, not allocated. **Active user** = a user with at least one `usage_events` row in the period.

**Currency:** USD only. All providers bill in USD; future Stripe/RevenueCat will settle to USD.

## Instrumentation

Each provider module in `apps/api/src/providers/` gets a `recordUsage(...)` helper. Pattern:

```ts
// Pseudocode, not final
async function chatWithRecording(client, input, ctx) {
  const result = await client.chat.completions.create(...);
  void recordUsage({
    userId: ctx.userId,
    platform: ctx.platform,
    provider: 'openai',
    operation: 'chat',
    units: result.usage.input_tokens,
    unitType: 'input_tokens',
    conversationId: ctx.conversationId,
    meta: { model: result.model },
  }).catch(captureSentry);
  // also one row for output_tokens
  return result;
}
```

**Key properties:**

- **Fire-and-forget** — the await is on the provider call, the insert runs in the background via `void`.
- **Streaming endpoints** — record on the `done` event (after the last byte has streamed to the client). User never waits.
- **No token counting** — every provider returns billable units in its response. We just read.
- **Failure isolated** — `recordUsage` errors go to Sentry only; user-facing call still succeeds.

Trade-off accepted: a Postgres outage during a deploy may drop a handful of events. The cost dashboard slightly under-counts for that window. Voice reliability is decoupled from billing DB reliability — the right priority order for this product.

## Admin API

All routes under `/admin/*` in `apps/api`. `requireAdmin` middleware: validate Supabase JWT → check `auth.uid()` is in `ADMIN_USER_IDS` env var. Returns 401 / 403 / 200 appropriately.

Endpoints (all accept `from`, `to`, `platform`, `service`, `userId` query params):

| Endpoint                                     | Returns                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /admin/auth/me`                         | `{ userId, email, isAdmin }`                                                              |
| `GET /admin/overview`                        | totals: variable cost, infra cost, total, projected month, active users, cost/active-user |
| `GET /admin/by-service`                      | `[{ service, cost, units, eventCount }]`                                                  |
| `GET /admin/by-platform`                     | `[{ platform, cost, eventCount }]`                                                        |
| `GET /admin/by-user`                         | `[{ userId, email, cost, eventCount, lastSeenAt }]` (sorted desc by cost)                 |
| `GET /admin/timeseries`                      | daily series for cost (stacked by service)                                                |
| `GET /admin/users/:id`                       | per-user detail: timeseries + breakdown by service + recent events                        |
| `GET /admin/rate-cards`                      | CRUD list                                                                                 |
| `POST /admin/rate-cards`                     | new rate card (auto-sets prev row's `effective_to`)                                       |
| `GET/POST/PATCH/DELETE /admin/fixed-costs`   | CRUD                                                                                      |
| `GET/POST/PATCH/DELETE /admin/upfront-costs` | CRUD                                                                                      |
| `POST /admin/internal/refresh-views`         | triggers materialized view refresh (called by Supabase cron)                              |

## Admin app (`apps/admin/`)

Next.js 14 app router, Tailwind, Recharts, TanStack Query. Magic-link auth via `@supabase/ssr`. Auto-refresh every 30s.

### Pages

1. **Dashboard (`/`)**
   - KPI row: Total this period · Variable · Infra · Active users · Cost/active user · Projected month
   - Stacked area chart: daily cost by service
   - Two-column: "By service" donut + "By platform" bar (iOS vs Android)
   - Recent events table (paginated)

2. **Users (`/users`)**
   - Sortable cost leaderboard. Search by email. Click → user detail page with their timeseries, breakdown by service, recent events.

3. **Services (`/services`)**
   - Per-service breakdown. Click → service detail with operation-level split and per-operation rate card visible.

4. **Settings (`/settings`)**
   - Tabs: **Rate cards** (table + add/edit with effective dates) · **Fixed costs** (add/edit recurring infra) · **Upfront costs** (one-time and amortized) · **Admins** (list of allowlisted user IDs, read-only — managed via env var).

### Filters

URL-driven (`?from=...&to=...&platform=...&service=...&userId=...`). The `service` filter is the union of distinct values across `usage_events.provider` (e.g. `openai`, `deepgram`) and `fixed_costs.service` (e.g. `fly`, `supabase`) — picking one filters both the variable-cost charts and the Infrastructure card consistently. Filter bar at top of every page applies to all charts and tables below. Filter rules:

- AND composition.
- `service ≠ All` → Infrastructure card shows only matching fixed-cost row (or empty).
- `user ≠ All` → fixed/upfront costs hidden with a note: _"Infrastructure isn't attributed per-user — see All Users view."_
- All-zero results → empty state, not a broken chart.

## Tests

Vitest, matching the existing pattern.

- **Unit:** rate-card lookup picks correct version for a given `created_at`. Pro-ration math (fixed costs). Amortization math (upfront costs). Attribution rule (variable → user, infra → unattributed).
- **Integration:** each provider wrapper writes exactly one `usage_events` row per call with correct `units`, `cost_usd`, `user_id`, `platform`. Real Postgres test DB.
- **Failure path:** insert failure does not propagate to caller. Sentry capture asserted via spy.
- **Admin API:** `requireAdmin` returns 403 for non-admin, 401 for unauth'd, 200 for allowlisted. Aggregations correct against seeded fixture data.
- **Admin app:** smoke-tested manually for MVP; Playwright tests added later if desired.

## Ops

- **Migrations:** Drizzle, applied through existing `pnpm db:migrate` flow.
- **Materialized view refresh:** Supabase scheduled function calls `POST /admin/internal/refresh-views` every 5 min.
- **Rate-card seeding:** `pnpm seed:rate-cards` one-time script; idempotent.
- **Env vars added:**
  - API: `ADMIN_USER_IDS` (comma-separated Supabase user IDs)
  - Admin app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `API_BASE_URL`
- **Vercel project:** new project linked to `apps/admin`. Root dir set. Env vars added. Free tier.
- **Monitoring:** Sentry — instrumentation errors flow to existing API Sentry. Admin app gets its own Sentry project.

## Open questions (resolved during brainstorming)

| Question                                 | Answer                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| When does this land?                     | Before Plan 8 launch — need unit-cost data to set freemium prices.                                                   |
| How are cost numbers computed?           | Estimate from usage × rate cards (Phase 1). **Bruno flagged interest** in monthly invoice reconciliation as Phase 2. |
| Where does the dashboard live?           | Separate Next.js app in monorepo (`apps/admin/`), Vercel-hosted.                                                     |
| Does instrumentation hurt voice latency? | No — fire-and-forget insert, ~0ms perceived. Trade-off: rare under-counting during Postgres outages.                 |

## Effort

~12–15 working days for MVP. Decomposed into ~8 sequenced tasks when we move to the implementation plan.
