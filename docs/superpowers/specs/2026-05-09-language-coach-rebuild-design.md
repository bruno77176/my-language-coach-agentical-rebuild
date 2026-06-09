# Design — My Language Coach rebuild

**Date:** 2026-05-09
**Status:** Awaiting user review of this spec
**Author:** Bruno + Claude (brainstorming session)
**Supersedes:** the legacy app at `my-language-coach/` and `my-language-coach-backend/` (audit at `AUDIT.md`)

---

## Summary

A from-scratch rebuild of the "My Language Coach" mobile app — an AI-powered conversational language coach for 12 languages — as a typed, tested, monorepo-organized product designed to support a freemium business model. The app is iOS + Android (React Native via Expo), the backend is a small Hono server on Fly.io, and Supabase provides auth, Postgres, and storage. The voice loop uses a streaming pipeline (Deepgram STT → GPT-4o-mini → ElevenLabs TTS) for the free tier, with the OpenAI Realtime API reserved as the upgrade path for paid users.

The design deliberately removes every class of bug catalogued in `AUDIT.md` for the legacy app: no shared device IDs as identity, no client-trusted minutes, no fixed-filename race conditions, no two-audio-engines fighting over the iOS session, no public leaderboard leaking identifiers, no anonymous backend access.

---

## Goals

- **Ship a Play Store internal-track build before 2026-07-04** to keep the existing developer account active.
- **MVP+ feature set:** onboarding, voice practice loop, streak counter, daily-goal indicator, translation toggle, share-conversation, profile editing, push-notification streak reminders, user-pickable conversation topics, conversation-derived vocabulary list.
- **Freemium-ready:** entitlements model + paywall scaffolding from day one, even though no payment integration is in MVP.
- **Real authentication:** Sign in with Apple + Google + magic-link email via Supabase Auth, required at onboarding.
- **Professional baseline:** TypeScript end-to-end, ≥80% unit-test coverage on shared/api/lib code, Sentry + PostHog from day one, GitHub Actions CI, EAS Update for OTA JS fixes.
- **Solo-developer-friendly:** ≤7 third-party services to manage (Supabase, Fly, Deepgram, OpenAI, ElevenLabs, Sentry, PostHog).

## Non-goals (explicit)

- **Leaderboard.** Cut from MVP — was a privacy liability in the legacy app and not the product's value proposition.
- **Payment integration.** Deferred to v1.1; entitlement model is in place but the paywall body is a "coming soon" waitlist form.
- **Voice activity detection (auto-stop on silence).** Push-to-talk only in v1; auto-VAD in v1.1.
- **Per-sentence streaming TTS.** Full-reply TTS only in v1; per-sentence in v1.1.
- **Conversation resume across app launches.** Daily cleanup job closes orphaned sessions.
- **Web version.** Mobile-only (iOS + Android). A marketing landing page is a separate concern.
- **Migration of legacy data.** Greenfield rebuild — no legacy users, sessions, or streaks carry over.

---

## 1. Architecture overview

Three independent systems, communicating over HTTPS only.

```
┌─────────────────────┐       ┌──────────────────────────┐
│   Mobile app        │       │   Hono backend (Fly.io)  │
│   (Expo, iOS+And.)  │──────▶│                          │
│                     │ HTTPS │  - Voice orchestration   │
│  - UI + audio       │       │  - Cost / quota gating   │       ┌──────────────┐
│  - TanStack Query   │       │  - Webhook receivers     │──────▶│  Deepgram    │
│  - Zustand          │       │  - Verifies Supabase JWT │       │  OpenAI      │
│  - Supabase SDK     │       │                          │       │  ElevenLabs  │
│  - Sentry/PostHog   │       └────────────┬─────────────┘       └──────────────┘
└──────────┬──────────┘                    │
           │                               │
           │  Supabase JS SDK              │  Drizzle ORM
           │  (auth + queries via RLS)     │  (server-side queries)
           │                               │
           ▼                               ▼
        ┌─────────────────────────────────────────┐
        │            Supabase                     │
        │  Auth  │  Postgres  │  Storage          │
        └─────────────────────────────────────────┘
```

### Ownership

- **Mobile app:** all UI, audio capture/playback, local state, the auth handshake (calls Supabase Auth directly), and read-only data fetches that go through Postgres Row-Level Security.
- **Hono backend:** anything needing a server-side secret (voice provider keys), anything needing quota/entitlement enforcement (free vs paid limits), anything needing audit (every voice minute logged), and webhook endpoints for future billing integration.
- **Supabase:** identity (who is this user), the Postgres database (users / conversations / messages / streaks / vocab / entitlements / push tokens), and Storage (user audio).

### Why this split

The mobile app does most of its work directly against Supabase via RLS-enforced queries — fast, no extra hop, no backend code to write for simple reads. The backend exists only for what the device can't do safely (calling third-party paid APIs) or shouldn't do (deciding "you've used your daily free minutes").

---

## 2. Repo structure + tech inventory

### Monorepo layout (pnpm workspaces + Turborepo)

```
my-language-coach/
├── apps/
│   ├── mobile/                  Expo app (iOS + Android)
│   └── api/                     Hono backend (deployed to Fly.io)
├── packages/
│   ├── shared/                  Zod schemas, TS types, prompts, language list
│   └── config/                  Shared ESLint + tsconfig + Prettier presets
├── docs/
│   ├── decisions/               ADRs (voice-loop options, stack explainer)
│   └── superpowers/specs/       Design specs from brainstorming sessions
├── .github/workflows/           CI pipelines
├── package.json                 Root, declares workspaces
├── pnpm-workspace.yaml
├── turbo.json
├── AUDIT.md                     Existing — legacy audit (kept for reference)
├── CLAUDE.md                    Existing — will be rewritten when scaffold lands
└── README.md
```

### `apps/mobile/`

```
app/                      Expo Router file-based routes
├── (auth)/               Sign in / verify
├── (onboarding)/         Name, native lang, target lang, daily goal
├── (tabs)/               Home, Practice, Progress, Profile
└── _layout.tsx           Root layout (auth gate, providers)
src/
├── components/           Shared UI (Button, Card, MicButton, ChatBubble…)
├── features/             Domain code grouped by feature (practice/, streak/, vocab/, topics/)
├── lib/                  Supabase client, API client, hooks, audio session helpers
└── styles/               NativeWind config
```

### `apps/api/`

```
src/
├── routes/               Hono routes split by domain (voice/, user/, billing-webhook/)
├── providers/            One file per external service (deepgram.ts, openai.ts, elevenlabs.ts)
├── db/                   Drizzle schema + query helpers
├── middleware/           Auth (Supabase JWT verify), rate limit, error handler
├── lib/                  Logging, Sentry init, env validation (Zod)
└── index.ts              App entrypoint
tests/                    Vitest tests, MSW mocks for external providers
```

### `packages/shared/`

Pure TypeScript, no runtime side effects beyond Zod. Imported by both `mobile` and `api`:

- `types.ts` — `User`, `Conversation`, `Message`, `StreakSummary`, `Entitlement`
- `schemas.ts` — Zod validators for every API request/response
- `prompts.ts` — system prompts for the coach, parameterized by language
- `languages.ts` — supported language list (codes, names, flags)

### Tech inventory

| Layer                 | Package                                   | Role                                                |
| --------------------- | ----------------------------------------- | --------------------------------------------------- |
| Monorepo              | `pnpm`, `turbo`                           | Workspaces + build orchestration                    |
| Mobile runtime        | `expo` (SDK 54+)                          | Native runtime + tooling                            |
| Mobile routing        | `expo-router`                             | File-based navigation                               |
| Mobile audio          | `expo-audio`                              | Recording + playback                                |
| Mobile push           | `expo-notifications`                      | Streak reminders                                    |
| Mobile auth + queries | `@supabase/supabase-js`                   | Auth + RLS-protected reads                          |
| Mobile server state   | `@tanstack/react-query`                   | Cache, retry, invalidation                          |
| Mobile local state    | `zustand`                                 | Recording state, modal state                        |
| Mobile styling        | `nativewind`                              | Tailwind utilities for RN                           |
| Mobile errors         | `@sentry/react-native`                    | Crash + perf monitoring                             |
| Mobile analytics      | `posthog-react-native`                    | Product events                                      |
| API runtime           | `hono` on `bun`                           | Web framework + JS runtime                          |
| API DB                | `drizzle-orm`, `postgres-js`              | Typed queries on Postgres                           |
| API validation        | `zod`                                     | Runtime input/output validation                     |
| API auth              | `@supabase/supabase-js` (server)          | Verify Supabase JWTs                                |
| API errors            | `@sentry/bun`                             | Server-side error capture                           |
| Shared lang           | `typescript`, `zod`                       | Types + validators                                  |
| Test (unit)           | `vitest`, `@testing-library/react-native` | Unit + component tests                              |
| Test (E2E)            | `maestro`                                 | Mobile E2E flows                                    |
| Lint/format           | `eslint`, `prettier`                      | Code style enforcement                              |
| CI                    | GitHub Actions                            | Lint + typecheck + test on PR; auto deploy on merge |

### Two structural decisions worth flagging

1. **`features/` folder under `mobile/src/`** instead of grouping by file type. Each feature owns its own components, hooks, and types — easier to delete a feature, easier to keep boundaries clean.
2. **Shared package is pure TS** — no React, no native deps, no runtime besides Zod. The API and mobile builds remain independent and the shared types are reusable in a future web admin/landing.

---

## 3. Data model

All tables in Postgres `public` schema except where noted. Every user-owned table has Row-Level Security on, with the policy "user can only see/touch rows where `user_id = auth.uid()`". The Hono backend uses the Supabase **service role key** to bypass RLS only when it must (e.g. mutating `entitlements`).

### `auth.users`

Managed by Supabase Auth. Untouched. Referenced by `id` (UUID) from every user-owned table.

### `profiles` — 1-to-1 with `auth.users`

| column               | type                          | note                                                                                               |
| -------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `user_id`            | `uuid` PK, FK→`auth.users.id` | mirrors auth id                                                                                    |
| `display_name`       | `text not null`               | from onboarding                                                                                    |
| `native_lang`        | `text not null`               | ISO code, e.g. `en`                                                                                |
| `target_lang`        | `text not null`               | ISO code                                                                                           |
| `daily_goal_minutes` | `int not null default 10`     |                                                                                                    |
| `timezone`           | `text not null`               | IANA, e.g. `Europe/Paris`. Captured at signup, used for streak day boundaries. Fixes audit bug I2. |
| `created_at`         | `timestamptz default now()`   |                                                                                                    |

### `conversations`

| column           | type                         | note                                 |
| ---------------- | ---------------------------- | ------------------------------------ |
| `id`             | `uuid` PK                    |                                      |
| `user_id`        | `uuid` FK→profiles           |                                      |
| `language`       | `text not null`              | snapshot at session start            |
| `topic_id`       | `uuid` FK→topics, nullable   | optional topic selector              |
| `started_at`     | `timestamptz default now()`  |                                      |
| `ended_at`       | `timestamptz`, nullable      | null while active                    |
| `seconds_spoken` | `int default 0`              | only seconds the user actually spoke |
| index            | `(user_id, started_at desc)` | feed listing                         |

### `messages`

| column               | type                             | note                                      |
| -------------------- | -------------------------------- | ----------------------------------------- |
| `id`                 | `uuid` PK                        |                                           |
| `conversation_id`    | `uuid` FK→conversations          |                                           |
| `role`               | `text check in ('user','coach')` |                                           |
| `text`               | `text not null`                  |                                           |
| `translation`        | `text`, nullable                 | cached on first translation request       |
| `audio_storage_path` | `text`, nullable                 | path in Supabase Storage; user audio only |
| `created_at`         | `timestamptz default now()`      |                                           |
| index                | `(conversation_id, created_at)`  | replay order                              |

### `topics`

Both built-in (seeded via migration) and user-created.

| column                   | type                    | note                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------ |
| `id`                     | `uuid` PK               |                                                        |
| `user_id`                | `uuid`, nullable        | null = built-in (visible to all)                       |
| `slug`                   | `text`                  | e.g. `ordering-coffee`, `job-interview`                |
| `label`                  | `jsonb`                 | `{"en": "Ordering coffee", "fr": "Commander un café"}` |
| `system_prompt_addendum` | `text`                  | appended to base coach prompt when picked              |
| `is_built_in`            | `boolean default false` |                                                        |

### `streak_days`

One row per day the user practiced (in their local timezone).

| column           | type                    | note                               |
| ---------------- | ----------------------- | ---------------------------------- |
| `user_id`        | `uuid` FK→profiles      |                                    |
| `date`           | `date not null`         | local date per user's timezone     |
| `seconds_spoken` | `int default 0`         | total across all sessions that day |
| `goal_reached`   | `boolean default false` | hit `daily_goal_minutes`?          |
| PK               | `(user_id, date)`       |                                    |

Current streak is computed at query time by a Postgres function — never stored.

### `vocab_items`

| column                  | type                         | note                                      |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| `id`                    | `uuid` PK                    |                                           |
| `user_id`               | `uuid` FK→profiles           |                                           |
| `language`              | `text not null`              | the target language the term is in        |
| `term`                  | `text not null`              |                                           |
| `translation`           | `text`                       | in user's `native_lang`, populated lazily |
| `first_seen_message_id` | `uuid` FK→messages, nullable | "where I learned this"                    |
| `mastery`               | `int default 0`              | 0=new, 1=seen, 2=remembered, 3=mastered   |
| `created_at`            | `timestamptz default now()`  |                                           |
| unique                  | `(user_id, language, term)`  | dedup per user                            |

### `entitlements`

The freemium gate. Mutated only by the backend (service role key).

| column                           | type                                          | note                                      |
| -------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `user_id`                        | `uuid` PK FK→profiles                         |                                           |
| `plan`                           | `text check in ('free','pro') default 'free'` |                                           |
| `pro_until`                      | `timestamptz`, nullable                       | when subscription ends                    |
| `monthly_voice_seconds_used`     | `int default 0`                               |                                           |
| `monthly_voice_seconds_reset_at` | `timestamptz`                                 | first of each calendar month at user's tz |

### `push_tokens`

| column            | type                              | note                       |
| ----------------- | --------------------------------- | -------------------------- |
| `user_id`         | `uuid` FK→profiles                |                            |
| `expo_push_token` | `text not null`                   |                            |
| `platform`        | `text check in ('ios','android')` |                            |
| `last_seen_at`    | `timestamptz default now()`       | for cleanup                |
| unique            | `(user_id, expo_push_token)`      | one row per token per user |

### `waitlist` (MVP-only, replaced by Stripe in v1.1)

| column       | type                         | note                                            |
| ------------ | ---------------------------- | ----------------------------------------------- |
| `email`      | `text PK`                    | from paywall sheet                              |
| `user_id`    | `uuid` FK→profiles, nullable | if already authed                               |
| `source`     | `text`                       | which trigger (`quota_exceeded`, `profile_cta`) |
| `created_at` | `timestamptz default now()`  |                                                 |

### Storage

One Supabase Storage bucket: `user-audio`. Layout: `{user_id}/{conversation_id}/{message_id}.m4a`. Access policy: `auth.uid()::text = (storage.foldername(name))[1]` — users can read/write only files in their own folder. Coach TTS audio is not stored; regenerated on replay.

### What's deliberately **not** in the schema

- **No `current_streak`, `total_minutes`, or other denormalized counters** — derived at read time. Stops the legacy bug where streak values disagreed across screens.
- **No `leaderboard` view** — leaderboard is cut.
- **No `provider_call_log`** — PostHog handles per-event analytics; cost monitoring goes through provider dashboards.
- **No `subscriptions` table** — billing comes after MVP. Will be added in v1.1.

### RLS summary

| Table                                                                    | Mobile app (anon role + user JWT)               | Backend (service role) |
| ------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------- |
| `profiles`                                                               | select/update own                               | full access            |
| `conversations`, `messages`, `vocab_items`, `streak_days`, `push_tokens` | select/insert/update/delete own                 | full access            |
| `topics`                                                                 | select where built-in or own; insert/delete own | full access            |
| `entitlements`                                                           | **select** own only                             | full access            |
| `waitlist`                                                               | insert own (or anon insert if not authed)       | full access            |
| `auth.users`                                                             | SDK methods only                                | (don't touch)          |

---

## 4. API surface

Two surfaces, deliberately split.

### Direct-to-Supabase (RLS-enforced) — no Hono code involved

| Operation                       | Supabase call                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Sign in / up / out              | `supabase.auth.signInWith…()`                                                          |
| Read own profile                | `supabase.from('profiles').select(...).single()`                                       |
| Update profile                  | `supabase.from('profiles').update(...)`                                                |
| List own conversations          | `supabase.from('conversations').select(...).order('started_at', { ascending: false })` |
| Read messages of a conversation | `supabase.from('messages').select(...).eq('conversation_id', id)`                      |
| List built-in + own topics      | `supabase.from('topics').select(...).or('is_built_in.eq.true,user_id.eq.' + uid)`      |
| Create custom topic             | `supabase.from('topics').insert(...)`                                                  |
| Read own vocab                  | `supabase.from('vocab_items').select(...)`                                             |
| Update vocab mastery            | `supabase.from('vocab_items').update({ mastery: 2 })`                                  |
| Read own streak history         | `supabase.rpc('current_streak')`                                                       |
| Read own entitlement            | `supabase.from('entitlements').select(...).single()`                                   |
| Register push token             | `supabase.from('push_tokens').upsert(...)`                                             |
| Read user audio file            | `supabase.storage.from('user-audio').createSignedUrl(...)`                             |
| Add to waitlist                 | `supabase.from('waitlist').insert(...)`                                                |

### Hono backend routes

All routes are versioned (`/v1/...`), require a valid Supabase JWT in `Authorization: Bearer ...`, and are validated end-to-end with Zod (request body, query, response).

#### Voice loop

| Method + path                       | Purpose                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /v1/voice/sessions`           | Start a conversation. Body: `{ language, topic_id? }`. Response: `{ conversation_id }`. Server creates the `conversations` row.                        |
| `POST /v1/voice/sessions/:id/turns` | Submit one user turn. Body: `multipart/form-data` with audio (m4a/wav). Response: SSE stream (see §5).                                                 |
| `POST /v1/voice/sessions/:id/end`   | Finalize. Server sets `ended_at`, updates `streak_days` for today, fires vocab extraction. Response: `{ seconds_spoken, streak_after, goal_reached }`. |

#### Translation

| Method + path                     | Purpose                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/messages/:id/translate` | Translate a coach message to user's `native_lang`. Server checks ownership via the conversation, calls GPT, caches in `messages.translation`. Idempotent. |

#### Vocab

| Method + path            | Purpose                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/vocab/extract` | Triggered by `/v1/voice/sessions/:id/end`. Pulls coach messages, calls GPT to extract 3-7 useful new terms, dedups, inserts. Async-fire-and-forget from user's perspective. |

#### Webhooks (placeholder)

| Method + path            | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `POST /webhooks/billing` | Stub for MVP. Will receive Stripe / RevenueCat events in v1.1. |

#### Operational

| Method + path | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `GET /health` | Liveness/readiness probe for Fly.io. Returns `{ status, db_ok, providers_ok }`. |

#### Scheduled jobs (cron, not HTTP routes)

| Job                           | Frequency                      | What it does                                                                                                  |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `daily-streak-reminder`       | Daily, per-user-timezone-aware | Finds users who haven't hit goal today and have a `push_token`, sends Expo Push notification.                 |
| `monthly-quota-reset`         | Daily at 00:00 UTC, idempotent | Resets `entitlements.monthly_voice_seconds_used` to 0 for users where `monthly_voice_seconds_reset_at` ≤ now. |
| `cleanup-stale-conversations` | Daily                          | Closes conversations open >24h with no `ended_at`.                                                            |

### Cross-cutting middleware (every Hono route)

1. **CORS** — allow only the mobile bundle ID origin (`com.anonymous.mylanguagecoach://`) plus `localhost` for dev.
2. **Request logging** — Pino structured logs with request ID, route, status, duration.
3. **Auth** — extract Bearer JWT, verify against Supabase JWKS, attach `c.set('userId', ...)`. 401 on missing/invalid.
4. **Rate limit** — per user-id, generous defaults (60 req/min). Voice routes have a stricter quota by `monthly_voice_seconds_used`.
5. **Zod validation** — request body + query + path params validated.
6. **Route handler.**
7. **Error handler** — converts unhandled errors to `{ error: { code, message } }`, never leaks stack traces, reports to Sentry.

### Surface size

- **6 Hono routes** (3 voice + 1 translate + 1 vocab + 1 webhook stub + 1 health).
- **3 scheduled jobs.**
- **~14 Supabase-direct operations** from the mobile app.

Compared to the legacy backend (12 unprotected routes), this is dramatically smaller — fewer places to enforce auth correctly = fewer bugs.

---

## 5. The voice loop in detail

### End-to-end flow for one practice session

```
Mobile                          Hono backend                Supabase                Providers
───────                         ────────────                ────────                ─────────
1. tap "Start"
   POST /v1/voice/sessions ───▶ verify JWT
                                 check entitlement
                                 INSERT conversations ────▶ row created
                              ◀─ { conversation_id }

2. configure audio session for RECORD (expo-audio, single transition)

3. tap mic, speak, release
   ┌─────────────────────────────┐
   │ for each user turn:         │
   │  POST /v1/voice/sessions/   │
   │   :id/turns (multipart) ──▶ verify JWT
   │                              quota check
   │                              ┌──── stream audio ────▶ Deepgram
   │                              ◀──── transcription ────
   │                              INSERT message (user) ▶ row created
   │                              upload audio (async)  ─▶ Storage
   │                              build prompt
   │                              ┌──── stream completion▶ GPT-4o-mini
   │                              SSE: transcription
   │                          ◀── SSE: reply-text-delta…
   │                              ◀──── full reply ──────
   │                              ┌──── synthesize ──────▶ ElevenLabs
   │                              ◀──── audio bytes ─────
   │                              upload audio          ─▶ Storage
   │                              INSERT message (coach)▶ row created
   │                              UPDATE conversations
   │                                  seconds_spoken
   │                          ◀── SSE: reply-audio { url }
   │                          ◀── SSE: done { message_id }
   │
   │  switch audio session to PLAY
   │  download + play coach audio
   └─────────────────────────────┘

4. tap "End"
   POST /v1/voice/sessions/:id/end ▶ UPDATE conversations.ended_at
                                     UPSERT streak_days for today
                                     fire vocab extraction (async)
                                  ◀─ { seconds_spoken, streak_after, goal_reached }
```

### SSE event protocol

`/v1/voice/sessions/:id/turns` returns `text/event-stream`. Defined events:

| Event              | Data                                                    | When                                                                |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `transcription`    | `{ text: string }`                                      | After Deepgram returns. Mobile renders user bubble.                 |
| `reply-text-delta` | `{ delta: string }`                                     | For each token chunk from GPT. Mobile appends to coach bubble live. |
| `reply-audio`      | `{ audioUrl: string, durationMs: number }`              | After ElevenLabs finishes + upload to Storage. Mobile plays.        |
| `done`             | `{ messageId: string }`                                 | Final event. Mobile marks the turn complete.                        |
| `error`            | `{ code: string, message: string, retryable: boolean }` | Any failure.                                                        |

**v1 simplification:** one `reply-audio` event per turn, after the full TTS is done — not per-sentence. ~500ms-1s slower than per-sentence streaming TTS, but cuts complexity dramatically. Per-sentence streaming is documented as a v1.1 upgrade.

### iOS audio session — fixing the legacy bug class

The legacy app's iPhone audio bugs came from two libraries fighting over the iOS audio session (`expo-av` + `react-native-audio-record`). The fix is structural:

- **Single library:** `expo-audio` handles both record and playback.
- **Explicit transitions:** before recording, `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })`. Before playback, `setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })`. Wrapped in a `useAudioSession()` hook so screens can't drift from this contract.
- **Interruption handler:** subscribe to `Audio.addInterruptionListener` (incoming call, Siri); on interruption, pause; on resume, re-issue `setAudioModeAsync` based on current state.
- **No 200ms timeouts.** The legacy hack at `ChatScreen.js:696` exists because the legacy code couldn't reason about session state. New code knows exactly which mode it's in.

### Error handling

Every failure mode has a structured error code. No generic "something went wrong":

| Backend code (HTTP + body)   | Cause                           | Mobile UX                                                                                                       |
| ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `QUOTA_EXCEEDED` (429)       | Free tier monthly minutes hit   | Paywall sheet: "You've used your 30 free minutes this month. Drop your email to be notified when Pro launches." |
| `AUDIO_TOO_SHORT` (422)      | <1s of audio uploaded           | Toast: "I didn't catch that — try again."                                                                       |
| `AUDIO_TOO_LONG` (413)       | >60s of audio in one turn       | Toast: "Try shorter turns — under a minute."                                                                    |
| `AUDIO_SILENT` (422)         | Server-side RMS below threshold | Toast: "I couldn't hear you — try again, closer to the mic."                                                    |
| `STT_PROVIDER_FAILURE` (503) | Deepgram errored or timed out   | Toast: "Connection trouble — tap mic to retry." `retryable: true`.                                              |
| `LLM_PROVIDER_FAILURE` (503) | OpenAI errored                  | Same toast.                                                                                                     |
| `TTS_PROVIDER_FAILURE` (503) | ElevenLabs errored              | Coach bubble shows text only with "🔇 audio failed" indicator + retry button. Conversation isn't blocked.       |
| `RATE_LIMITED` (429)         | Per-IP rate limit hit           | Toast: "Slow down — try again in a moment."                                                                     |
| `UNAUTHORIZED` (401)         | JWT expired/invalid             | Mobile triggers `supabase.auth.refreshSession()`, retries once. If still 401, sign out.                         |
| `INTERNAL` (500)             | Anything unhandled              | Toast: "Something went wrong — your session is safe, try again." Sentry captures.                               |

Network-level failures: SSE reader detects close-without-`done`, shows "Lost connection — tap to retry". User audio preserved locally; conversation row stays open server-side; nothing is lost.

### Quota gating

- **Free tier:** 30 min/month of voice. Monthly reset on the 1st at user's local timezone.
- **Pro tier:** unlimited.

Enforcement order on every `/turns` request:

1. Read `entitlements` for the user.
2. If `plan = 'pro'` and `pro_until > now()`, allow.
3. Else, estimate this turn's audio duration upfront (from `Content-Length` and bitrate hint, ~5% margin). If `monthly_voice_seconds_used + estimate > limit`, return `QUOTA_EXCEEDED` immediately, before calling any provider.
4. After STT completes, increment `monthly_voice_seconds_used` by actual user audio duration (Deepgram returns this).

A quota-exceeded user never costs us a Deepgram call.

### What's deliberately NOT in v1

- **No voice activity detection (VAD)** — push-to-talk only.
- **No per-sentence streaming TTS** — full-reply TTS only.
- **No conversation resume across app launches** — closed by daily cleanup job.
- **No fallback STT/LLM/TTS providers** — single provider per stage.
- **No client-side silence detection** — server enforces minimum audio length.

---

## 6. Mobile structure + operations

### Navigation tree (Expo Router file-based)

```
app/
├── _layout.tsx                 Auth gate, providers (TanStack, PostHog, Sentry)
├── (auth)/                     No auth required
│   ├── _layout.tsx             Redirect to /(tabs)/home if signed in
│   ├── sign-in.tsx             Apple / Google / email magic link
│   └── verify.tsx              Magic link return URL handler
├── (onboarding)/               Requires auth, only if profile incomplete
│   ├── _layout.tsx             Multi-step state via Zustand
│   ├── name.tsx                Step 1
│   ├── native-lang.tsx         Step 2
│   ├── target-lang.tsx         Step 3
│   └── daily-goal.tsx          Step 4 → INSERT profile + entitlement → /(tabs)/home
└── (tabs)/                     Requires auth + completed onboarding
    ├── _layout.tsx             Bottom tab nav
    ├── home.tsx                Quote, "start practicing", today's progress
    ├── practice.tsx            The voice loop screen
    ├── progress.tsx            Streak calendar, total minutes
    └── profile.tsx             Edit profile, language, goal, sign out, upgrade CTA
```

The root `_layout.tsx` is the only auth gate. No more "every screen calls `getOrCreateDeviceId()` then `fetchUserData()`".

### State management split

| Kind                     | Tool                             | Examples                                                        |
| ------------------------ | -------------------------------- | --------------------------------------------------------------- |
| Server state             | TanStack Query                   | profile, conversations, streak summary, entitlement, vocab list |
| Auth state               | Supabase auth listener → Zustand | `session`, `userId`, `signOut()`                                |
| Recording state          | Zustand                          | `isRecording`, `audioUri`, `durationMs`                         |
| Multi-step form state    | Zustand (per group)              | onboarding wizard state                                         |
| Modal / sheet visibility | Local `useState`                 | exit-confirmation modal, paywall sheet                          |

### Auth flow

**Sign-in providers:**

1. **Sign in with Apple** — required on iOS by App Store policy if any other social login is offered.
2. **Continue with Google** — primary on Android, also offered on iOS.
3. **Email magic link** — universal fallback.

**Onboarding sequence (first sign-in):**

1. Sign in with provider
2. Auth listener fires → check `profiles` for this `user_id`
3. No row → redirect to `(onboarding)/name`
4. Wizard collects: `display_name → native_lang → target_lang → daily_goal`
5. Final step: a single Supabase RPC call `complete_onboarding(display_name, native_lang, target_lang, daily_goal_minutes, timezone)` inserts `profiles` + default `entitlements` (plan='free') atomically server-side. Avoids the failure mode where one insert succeeds and the other doesn't, leaving the user wedged.
6. Navigate to `(tabs)/home`

### Freemium scaffolding (no billing in MVP, but everything wired)

- `entitlements` row exists for every user from signup, defaulting to `plan='free'`.
- `useEntitlement()` hook returns `{ plan, secondsRemainingThisMonth, resetAt }`.
- `<Paywall />` component triggered by:
  - Backend returning `QUOTA_EXCEEDED` mid-session.
  - User tapping "Upgrade" in Profile.
  - Locked-feature taps.
- In MVP, the paywall body is a "Coming soon — drop your email to be notified" form. Captures intent + email into the `waitlist` table.
- When billing lands (v1.1), only the paywall body changes.

### Testing strategy

**Unit (Vitest)** — pure logic:

- `packages/shared/`: every Zod schema, every prompt builder.
- `apps/api/src/lib/`: streak computation, quota math, error mapping, audio duration parsing.
- `apps/mobile/src/lib/`: API client error mapping, audio session state machine, hooks.
- Coverage target: **80%**. Hard CI gate.

**Component (Vitest + RNTL)** — UI in isolation:

- Mocked Supabase + API via MSW.
- Targets: `<Paywall />`, `<MicButton />`, `<ChatBubble />`, streak counter, onboarding wizard.

**API integration (Vitest)** — Hono routes against real Postgres:

- Postgres in Docker service container on CI; `docker-compose up postgres` for local.
- Drizzle migrations applied to fresh DB at start of each test file.
- Deepgram / OpenAI / ElevenLabs mocked via MSW with realistic fixtures.
- Every endpoint covers: happy path + each documented error code.
- Coverage target: **80%** on `apps/api/src/routes/` and `apps/api/src/lib/`.

**E2E (Maestro)** — three flows for MVP:

1. Onboarding (email magic link via test inbox like Mailosaur).
2. First practice session (canned audio file, mocked voice providers).
3. Quota gate (pre-set entitlement to "almost out", assert paywall shows).

- Runs **nightly** on Maestro Cloud against an EAS preview build (not on every PR).

**Manual testing on Bruno's Android device:**

- One-time setup: `eas build --profile development --platform android`, install resulting APK on device.
- Day-to-day: `pnpm dev` runs Metro; the device's dev client connects over the LAN; JS changes hot-reload.
- Native changes (new Expo module, plist/manifest changes) require a fresh dev-client build.
- iOS testing deferred until Android flow is solid; uses TestFlight via `eas build --profile preview --platform ios` + `eas submit`.

### Observability

**Sentry** — one project, two environments (`mobile`, `api`):

- Mobile: `@sentry/react-native` initialized at app entry. Breadcrumbs from navigation + Supabase + API client. Source maps uploaded by EAS Build.
- API: `@sentry/bun` initialized at server start. Per-request context: `userId`, `requestId`, `route`. Source maps uploaded by GitHub Actions.
- Performance traces: 10% sample in prod, 100% in staging.

**PostHog** — product analytics:

- Initial events: `signup_completed`, `onboarding_completed`, `practice_session_started`, `practice_session_ended`, `daily_goal_reached`, `paywall_shown`, `paywall_dismissed`, `paywall_waitlist_signup`.
- Funnels: signup → first session, first session → goal-met-day-7.

### CI/CD + deployment

**GitHub Actions workflows:**

| Workflow            | Trigger                                                       | Steps                                                                                                           |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ci.yml`            | Every PR                                                      | pnpm install (cached) → `turbo run typecheck lint test` → API integration tests with Postgres service container |
| `api-deploy.yml`    | Merge to main, paths `apps/api/**` or `packages/shared/**`    | `flyctl deploy` → `drizzle-kit migrate` → Sentry release tag                                                    |
| `mobile-update.yml` | Merge to main, paths `apps/mobile/**` or `packages/shared/**` | `eas update --branch production` (JS-only OTA)                                                                  |
| `mobile-build.yml`  | Manual dispatch                                               | `eas build --platform all --profile production` + `eas submit`                                                  |
| `e2e.yml`           | Nightly cron                                                  | Maestro Cloud against EAS preview build                                                                         |

Branch protection: `main` requires passing CI, no direct pushes, squash-merge only.

EAS Update lets us ship JS-only fixes (the legacy bug C1 type) to existing installs in seconds without store review.

---

## Open questions / future work

- **Specific paywall copy + waitlist email automation** — defer to v1.1 brainstorming.
- **Push notification copy + send-time optimization** — start with naive "send 4h before user's typical practice time"; iterate.
- **Vocab UI design** — list view + per-item card with mastery toggle is the v1; spaced-repetition UI is v1.2+.
- **Topics catalog** — initial seed of ~20 built-in topics in `packages/shared/topics.seed.ts`. Curate post-MVP based on what users pick.
- **Apple Developer account** — Bruno needs to verify the existing one (`bruno.a.moise@gmail.com`) is still active before iOS submission.

---

## References

- `AUDIT.md` — legacy app audit (root of workspace)
- `docs/decisions/2026-05-09-voice-loop-options.md` — comparison of three voice architectures
- `docs/decisions/2026-05-09-stack-explained-fr.md` — explanation of every chosen tool (in French) with alternatives + rationale, including the ephemeral-key-minting addendum
- `CLAUDE.md` — current legacy-app guidance; will be replaced once the rebuild scaffold lands
