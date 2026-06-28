# Pre-Launch Full Audit — My Language Coach

**Date:** 2026-06-27
**Goal under audit:** 10,000 users and ≥200 paying users by end of 2026, marketing launch this summer (within weeks).
**Scope:** Technical, security, and product/marketing/conversion risk across the live monorepo (`app/`).
**Method:** Three parallel codebase audits, with the highest-impact findings re-verified by hand against source. Severity reflects impact on the 10K / 200-paid goal, not abstract risk.

> **Verification note.** One automated finding ("a single TTS failure kills the whole turn via `Promise.all`" at `run-turn.ts:81`) was **incorrect** and has been removed. `emit()` catches its own errors and routes them to `onChunkError` (`run-turn.ts:54-64`), so a turn _survives_ per-sentence TTS failures. The real defect there is the missing timeout (see P0-3). Everything below was checked before inclusion.

---

## 1. Tech-stack verdict — "Do I need to change anything?"

**No rewrite needed. Keep the stack; tune it.**

Hono on Fly.io + Supabase Postgres (Drizzle) + Expo SDK 54 + Next.js/Vercel is the right architecture for 10K users / ~5K DAU. Every scaling risk found is **configuration or tuning, not architecture**:

- DB connection pool, Fly machine count, and provider timeouts are one-line/one-config changes.
- The cascade voice pipeline (Deepgram STT → OpenAI LLM → TTS router) is appropriate for launch. Real-time speech-to-speech is a _later_ optimization (Horizon 2), **not** a launch blocker.
- A rewrite would only do one thing right now: delay the summer launch. Don't.

---

## 2. Findings

Severity = impact on the 10K-users / 200-paid goal.

### P0 — Launch blockers (fix before the marketing push)

| #                                | Area           | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                | Fix                                                                                                                                   |
| -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**P0-1**~~ **CORRECTED → low** | Monetization   | **Original finding was wrong.** I flagged "RevenueCat keys absent from the `production` EAS profile → 0 conversions," reading only the committed `eas.json`. The wiring is actually **correct**: `app.config.ts:143-146` injects the keys from `process.env`, and `_layout.tsx:35-40,96-97` reads them and calls `Purchases.configure()`. The real keys are **intentionally not committed** — they come from EAS env vars/secrets at build time (same as ADMOB keys); only the throwaway `test_` key is inline (`eas.json:62`). Bruno confirms prod keys are set. | `app.config.ts:143-146`, `_layout.tsx:35-40`                                                                            | **Not a blocker.** Just confirm `eas env:list --environment production` shows both keys and run one sandbox purchase. No code change. |
| **P0-2**                         | Scaling        | **DB pool `max: 10` vs Fly concurrency 250.** Each turn runs ~7 DB ops; under load, queries queue behind 10 connections → cascade timeouts (no statement timeout set either).                                                                                                                                                                                                                                                                                                                                                                                     | `apps/api/src/db/client.ts:10`; `apps/api/fly.toml:23-24`                                                               | Raise pool to ~50–75 via the Supabase pooler (pgbouncer, port 6543); add a statement timeout.                                         |
| **P0-3**                         | Reliability    | **No request timeouts on OpenAI (LLM + TTS) or Deepgram (STT).** Only Gemini has an 8s timeout. A slow provider hangs a turn indefinitely, holding a Fly concurrency slot forever; at scale, hung turns starve all users.                                                                                                                                                                                                                                                                                                                                         | `apps/api/src/providers/openai.ts`, `providers/deepgram.ts` (no `AbortController`); contrast `providers/gemini.ts` (8s) | Wrap every provider call in an `AbortController` with an 8–12s timeout.                                                               |
| **P0-4**                         | Cost control   | **No per-provider spend ceiling and no per-user rate limit.** A daily _usage_ quota exists, but no burst throttle: one buggy or abusive client can fire unlimited turns → runaway ElevenLabs/OpenAI/Deepgram bill (per-key credit caps hit → all TTS starts 429-ing for everyone).                                                                                                                                                                                                                                                                                | `apps/api/src/lib/quota.ts` (usage cap only); no rate-limit middleware in `routes/voice.ts`                             | Add per-user request rate limit (e.g. 3 turns/s) + a daily per-provider spend guard; alert at 80% of budget.                          |
| **P0-5**                         | Security       | **Auth tokens stored in AsyncStorage (plaintext), not SecureStore.** JWTs are readable on a rooted/compromised device or via unencrypted backup. SecureStore is already a dependency. Also a Play Store data-safety concern.                                                                                                                                                                                                                                                                                                                                      | `apps/mobile/src/lib/supabase.ts:11` (`storage: AsyncStorage`); `expo-secure-store` in `package.json`                   | Swap Supabase `auth.storage` to an `expo-secure-store` adapter.                                                                       |
| **P0-6**                         | Security (ops) | **Legacy OpenAI + Google TTS keys are still hot in the legacy Render env.** Standing liability; unrelated to the new app but a live breach vector.                                                                                                                                                                                                                                                                                                                                                                                                                | CLAUDE.md "Legacy operational liabilities"                                                                              | Rotate/revoke the legacy keys; confirm done.                                                                                          |
| **P0-7**                         | Conversion     | **Forced signup before any product value.** Anonymous users are redirected straight to sign-in — no way to try the product. Kills install→activation on app-store organic traffic.                                                                                                                                                                                                                                                                                                                                                                                | `apps/mobile/app/index.tsx:18-19`                                                                                       | Add a guest / "try one free conversation" mode.                                                                                       |

### P1 — High (drives low ratings, churn, lost conversion)

| #        | Area              | Finding                                                                                                                                                                           | Evidence                                                                              | Fix                                                                                                                |
| -------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **P1-1** | Conversion        | **Free-tier cliff: 10 min/day for 3 days, then 5 min/day.** ~5 min ≈ one short session; the drop feels punitive → bad reviews + churn before a habit forms.                       | `apps/api/src/env.ts` (`FREE_TIER_VOICE_SECONDS_PER_DAY=300`, honeymoon `600`/3 days) | Raise baseline to 10 min/day **or** extend honeymoon to 7 days. Low effort (env values).                           |
| **P1-2** | Reach             | **App UI is English-only across all 15 learning languages.** Non-English learners (incl. French, the #2 market) get a jarring English shell — caps the addressable market.        | No i18n system in `apps/mobile`; deferred in REMAINING-WORK                           | Localize onboarding + paywall + core to **French first**.                                                          |
| **P1-3** | Resilience        | **No retry/backoff on transient provider errors.** A 1–2 min Deepgram/OpenAI 503 spike permanently fails every in-flight turn; users conclude the app is broken.                  | `routes/voice.ts` (catch-emit-once); `tts-router.ts` fallback is per-sentence only    | Add exponential-backoff retry (2 attempts) around provider calls.                                                  |
| **P1-4** | Scaling           | **Single Fly machine (`min_machines_running = 1`), already OOM'd once** under TTS + in-memory inline audio at 256MB (now 1GB, root cause undiagnosed). One restart = full outage. | `apps/api/fly.toml:18, 33-39`                                                         | Run ≥2 machines for redundancy; heap-profile under load; stream TTS to storage instead of buffering base64 in RAM. |
| **P1-5** | Expectations      | **Marketing site shows no pricing / free-cap info.** Users download, hit the 5-min wall fast → "bait & switch" perception → 1-star reviews.                                       | `apps/web` (no pricing section)                                                       | Add a Pricing section (Free vs Pro) to set expectations pre-install.                                               |
| **P1-6** | Ops visibility    | **Admin dashboard has a known 500** (server-component cookie write) → flying blind on cost/revenue at launch, exactly when unit economics matter most.                            | REMAINING-WORK; `apps/admin`                                                          | Fix the cookie write.                                                                                              |
| **P1-7** | Feature integrity | **Voice-live is allowlisted + half-duplex.** If marketed as "real-time," most users either can't access it or it feels laggy (coach talks over barge-in).                         | `routes/voice-live.ts`; `practice.tsx` `canLive`; REMAINING-WORK                      | Hide it, or label "Beta" with mic-muting during playback; don't advertise real-time yet.                           |

### P2 — Medium (polish, retention, correctness)

- **No live-mode turn timeout** — a hung `runTurn` in the WebSocket path can soft-lock the session. Wrap in a `Promise.race` timeout. (`routes/voice-live.ts`)
- **Onboarding progress counter is wrong** — dots show "4 total" but there are 5 steps (memory-consent has none). Confusing mid-flow. (`app/(onboarding)/*`)
- **iOS vs Android bundle IDs differ** — `com.brunomoise.mylanguagecoach` vs `com.anonymous.mylanguagecoach`. Brand/support confusion; far harder to fix post-launch. (`app.config.ts`)
- **PostHog key is a placeholder in all EAS profiles** — no product analytics at launch, so you can't measure the very funnel (install → activation → paywall → purchase) you need to hit 200 paid. (`eas.json:18,36,74`)
- **Coach-memory (Pro feature) design is unfinished** — the paywall promises "remembers you across sessions"; 4 design decisions remain open. Risk of disappointing Pro buyers. (REMAINING-WORK)
- **Post-turn feedback / memory-extraction calls have no timeout** — slow OpenAI delays end-of-session feedback. (`lib/extract-memory.ts`, `lib/generate-feedback.ts`)
- **Integration tests cover only `/health`** — the voice cascade has no integration coverage, so provider-wiring regressions pass CI. (`tests/integration/`)
- **Google Play legacy dev-account closure risk by 2026-07-04** — confirm the app ships under the new account.

### P3 — Low (post-launch)

- Daily-quote catalog still at 50 (repetition after a few weeks); avatar upload missing; no certificate pinning; missing "Decide later" on memory-consent; expand i18n to CJK markets after French.

### Positive findings (no action needed)

- JWT verification checks the email-verified claim (the 2026-05-28 signup exploit is fixed).
- RLS on user-owned tables; admin (`ADMIN_USER_IDS`) and voice-live (`VOICE_LIVE_USER_IDS`) allowlists enforced.
- Account-deletion is user-enumeration-safe and deletes stored audio.
- Zod validation on API inputs; Drizzle parameterized queries (no SQL injection surface).
- Good DB indexes on hot paths; the turn route parallelizes its reads (no N+1).

---

## 3. Cost model at scale (economic reality check)

At ~5K DAU × ~10 turns/day, baseline provider spend ≈ **$3,100–3,500/month**:

| Provider             | Rough monthly | Notes                                  |
| -------------------- | ------------- | -------------------------------------- |
| Deepgram STT         | ~$1,300       | ~$0.0043/min                           |
| OpenAI (gpt-4o-mini) | ~$800         | ~500 tokens/turn                       |
| ElevenLabs TTS       | ~$1,000       | per-key credit cap → hard 429 when hit |
| Supabase             | ~$100–200     | storage + compute                      |

**200 paid users at a typical ~$8–10/mo Pro ≈ $1,600–2,000 MRR — which does not cover provider cost at 5K DAU.** This is the most important strategic finding in the audit: the free tier is the cost center, and at scale free-tier voice minutes can outrun revenue. The free cap + rewarded ads + Pro "tripod" must be tuned for economic survival, not just UX. This elevates **P0-4 (spend ceiling)** and **P1-1 (cap tuning)** from "nice" to "survival." It also argues for keeping cheaper TTS providers (Gemini/OpenAI) as the _default_ for free users and reserving ElevenLabs premium voices for Pro.

---

## 4. Recommended sequence before marketing spend

1. **Confirm monetization works (P0-1 — corrected, not a blocker).** RevenueCat wiring is correct; just verify the prod EAS env vars hold the keys and run one sandbox purchase.
2. **Make it not fall over (P0-2, P0-3, P0-4, P1-3, P1-4).** Pool size, timeouts, rate limit + spend ceiling, retries, ≥2 machines.
3. **Close the security gaps (P0-5, P0-6).** SecureStore migration; rotate legacy keys.
4. **Fix the funnel (P0-7, P1-1, P1-2, P1-5).** Guest mode, looser free cliff, French UI, pricing on the site.
5. **See what's happening (P2 analytics + P1-6 admin 500).** Real PostHog key; fix the dashboard — you cannot optimize toward 200 paid blind.

---

## 5. The finding most likely to cause failure

- **P0-7 + P1-1 (forced signup + 5-min cliff):** the two largest leaks in the acquisition→activation→conversion funnel. Organic app-store installs abandon at signup; survivors hit a punitive wall before a habit forms. Together they can quietly cap you well below 10K active users.

---

_Generated 2026-06-27. Findings re-verified against source where they drive a recommendation. Next step (per Bruno): provide further inputs to continue the pre-launch audit; remediation backlog and fixes deferred._
