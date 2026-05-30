# Plan 8 — The Coaching Loop — Design

**Date:** 2026-05-30
**Status:** Draft — awaiting Bruno approval
**Author:** Bruno + Claude (brainstorming session)

## Why

The current rebuild (Plans 1–7) ships a working voice loop but no coaching layer: every session starts cold ("hi, I'm your coach, how can I help?"), there is no end-of-session payoff, and there is nothing to upsell to a Pro tier. The Round 2 strategy doc (`docs/superpowers/brainstorming/2026-05-30-strategy-round-2.md`) establishes that this gap is also the only competitive differentiator left for an indie in the 2026 AI-conversation-coach market — Speak/Talkpal/Babbel-Speak own conversation, but no one ships memory + structured feedback + scenario practice as one coherent loop.

Plan 8 ships that loop, plus the freemium paywall that makes it monetizable, plus the push notifications that fight Day-7 churn (>95% in education-app median). After Plan 8 the app has paying users or it has data telling us the positioning is wrong.

Calibrations from Bruno (carried into this spec):

- **Success ceiling is $1k MRR.** This is a side hustle, not a venture bet. Don't over-engineer for $10k+.
- **Fast iteration** — 5 weekly milestones compressed into ~2 days, each shippable to Bruno's Android phone as an APK he tests himself before the next milestone starts.
- **Plan 8 only.** Plans 9 (vocab card game) and 10 (pronunciation) are deferred until Plan 8 validates.
- **No Play deadline pressure.** Google account is paid + active; we can ship to production whenever code is ready.
- **Android-first for v1.** iOS deferred (Bruno has no Apple device); TestFlight build later if Plan 8 validates.

## Scope

### In this plan

- **`apps/api`** — new schemas (`coach_memory`, `session_feedback`, extended `entitlements`), new module `apps/api/src/lib/features.ts` for feature-gating, extended `voice.ts /end` handler (memory extraction + feedback generation), new `voice.ts /sessions/:id/feedback` endpoint (read), extended session-start path for role-play scenarios, daily-quota wrap on the voice endpoint, new push-notification jobs (Day 1/2/7).
- **`packages/shared`** — extended `buildCoachSystemPrompt` (memory injection + role-play scenario template), new `role-play-scenarios.ts` catalog (10 scenarios), Zod schemas for `CoachMemory` and `SessionFeedback`.
- **`apps/mobile`** — new memory-consent screen in onboarding, new memory editor under Profile, new end-of-session sheet (3 panels: highlights / corrections / vocab), new role-play picker modal, new paywall modal, RevenueCat integration via `react-native-purchases`, Day-1 push permission prompt.
- **Supabase** — three migrations (`0010_coach_memory.sql`, `0011_session_feedback.sql`, `0012_entitlements_daily_quota.sql`) plus RLS policies on the new tables.
- **RevenueCat dashboard** — products configured ($7.99 monthly, $49.99 annual, 7-day trial), entitlement named `pro` wired to both products, webhook to API.
- **Google Play Console** — subscription products defined matching RevenueCat product IDs, internal track build submitted.

### Explicitly deferred

- **Plan 9 — Vocab Loop** (vocab extraction at session end + SRS card game). The `vocab_items` table is already in the schema; Plan 8 leaves it untouched.
- **Plan 10 — Pronunciation Loop** (Azure Pronunciation Assessment + user-audio storage + daily auto-lesson + real-time gentle correction).
- **TTS provider abstraction.** Stay on OpenAI TTS (`gpt-4o-mini-tts`) for Plan 8. Premium TTS (Inworld, Gemini Flash TTS) is a Plan 10 candidate and not worth building infra for at $1k MRR target.
- **Day-14 churn-rescue push.** Days 1/2/7 are enough for v1. Add Day 14 only if push open rates justify it after launch.
- **iOS submission.** Code is platform-agnostic; iOS-specific config (Apple Pay, StoreKit, APNs cert, App Store Connect subscription products) is a follow-up week.
- **Web paywall / web subscription flow.** Apps/web stays marketing + auth-verify + delete-account only.
- **Conversation continuation prompt** ("Last time we were talking about your trip to Mexico — want to keep going?"). Falls out of memory naturally — the coach will reference recent topics if memory loads. A dedicated continue-or-fresh UI button is YAGNI for v1.
- **Geographic pricing tiers, lifetime founders deal, referral codes.** Not for v1.
- **Memory hybrid with vector RAG.** Approach #4 (structured profile only) is the v1; vector recall is a future iteration if memory feels lossy.

## Architecture

### Memory — the "coach remembers you" feature

**Storage:** new `coach_memory` table, keyed `(user_id, language_code)`. Per-language scope (Bruno's confirmed decision): study Italian AND Spanish = two separate memory rows, never crossed.

Schema:

```sql
CREATE TABLE coach_memory (
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language_code      text NOT NULL,
  proficiency_level  text,                          -- e.g. "A2", "B1"
  recent_topics      jsonb NOT NULL DEFAULT '[]',   -- [{topic, last_practiced_at}]; capped at 20
  weak_areas         jsonb NOT NULL DEFAULT '[]',   -- ["subjunctive", "false-friends-pt-it"] (Pro)
  personal_context   jsonb NOT NULL DEFAULT '{}',   -- {hobbies, job, family_ages, ...}    (Pro)
  last_session_summary text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language_code)
);
```

**RLS:** `FOR ALL USING (auth.uid() = user_id)` plus `WITH CHECK (auth.uid() = user_id)` on insert/update (critical — without `WITH CHECK`, updates silently affect 0 rows per the Plan 5 lesson).

**Write path** — at `voice.ts /end`, after streak upsert, fire-and-forget call to `extractMemory({ existingMemory, transcript, language, plan })`:

1. Loads existing `coach_memory` row (or empty default if first session in this language).
2. One `gpt-4o-mini` call with system prompt: "You update a structured language-learner profile. Given the existing JSON memory and a new conversation transcript, return updated JSON that strictly conforms to the provided schema. If a field is unchanged, return its existing value. If a fact is unclear, omit rather than guess. Cap recent_topics at 20 most-recent entries."
3. Output validated with Zod (`CoachMemorySchema`).
4. Upsert.
5. Recorded as `usage_events { operation: 'extract-memory:gpt-4o-mini' }` via existing `onUsage` callback.
6. Failures swallowed and reported to Sentry — never break the session-end response.

Cost: ~200 input + 300 output tokens × ($0.15 + $0.60)/M = **~$0.0002/session**. Negligible.

**Read path** — at the start of each session, `streamChatCompletion` loads memory and passes to `buildCoachSystemPrompt`:

```ts
function buildCoachSystemPrompt(input: {
  targetLanguage: string;
  userDisplayName: string;
  memory?: CoachMemory | null; // NEW
  scenario?: RolePlayScenario | null; // NEW
}): string {
  // existing base prompt...
  if (input.memory) {
    parts.push(`<context>
The student's name is ${input.userDisplayName}. ${freeMemoryBlock(input.memory)}${proMemoryBlock(input.memory)}
Reference these naturally when relevant. Do not list them robotically.
</context>`);
  }
  if (input.scenario) {
    parts.push(`<scenario>${input.scenario.systemPromptFragment}</scenario>`);
  }
  return parts.join("\n\n");
}
```

`freeMemoryBlock` returns name + level + recent topics + last-session summary. `proMemoryBlock` returns the additional weak_areas + personal_context. The feature-gating module decides which block to include based on `entitlements.plan`.

**Free vs Pro split for memory (Bruno's confirmed decision):**

| Field                  |    Free    |     Pro     |
| ---------------------- | :--------: | :---------: |
| `proficiency_level`    |     ✓      |      ✓      |
| `recent_topics`        | ✓ (last 5) | ✓ (last 20) |
| `last_session_summary` |     ✓      |      ✓      |
| `weak_areas`           |            |      ✓      |
| `personal_context`     |            |      ✓      |

The free block is enough to make the coach feel "knows me." The Pro block is the "knows me deeply" upgrade. Bruno's vote rules: locking memory entirely behind Pro kills the funnel because the free experience would be worse than ChatGPT Voice (which at least has session-internal memory).

**Consent flow:** new onboarding screen `(onboarding)/memory-consent.tsx` shown after the existing 4-step wizard, before the home tab. Text:

> **Your coach remembers you.**
>
> To make your conversations feel like real coaching, we save a short profile of what you've talked about, your level, and topics you want to practice. You can view, edit, and delete this memory anytime under Profile → Coach's Memory.
>
> [Continue] [Skip — I don't want my coach to remember me]

Skipping sets `coach_memory.opted_out = true` (need a column for this — added to migration `0010`) and prevents both write and read paths from running for that user. Pro can re-enable from Profile.

**Editor screen:** new `(tabs)/profile/memory.tsx` route. Per-language tabs (target lang first; if user has multiple langs studied, additional tabs). Each tab shows the structured fields as editable text inputs + a "delete this memory" button (deletes the row for that language only).

### Feedback — the end-of-session coaching payoff

**Storage:** new `session_feedback` table, one row per conversation.

```sql
CREATE TABLE session_feedback (
  conversation_id  uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  highlights       jsonb NOT NULL DEFAULT '[]',  -- [{phrase, why}]
  corrections      jsonb NOT NULL DEFAULT '[]',  -- [{you_said, better, explanation}]
  vocab            jsonb NOT NULL DEFAULT '[]',  -- [{term, translation, source_phrase}]
  status           text NOT NULL DEFAULT 'pending', -- pending | ready | failed
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

RLS: scoped via the parent `conversations` row (nested pattern from `0001_rls_policies.sql`).

**Delivery: async via separate endpoint** (Bruno's open-question default, confirmed by strategy Round 2 vote). Reasoning: synchronous in `/end` adds 3–5 sec latency, blocks the session-end sheet from rendering, and the sheet's "loading your feedback…" state is friendlier than a stalled exit animation.

Flow:

```
mobile: POST /sessions/:id/end       →  api: row created, status=pending,
                                          fire-and-forget feedback job kicked
mobile: navigate to end-of-session sheet
mobile: GET  /sessions/:id/feedback  →  api: returns {status:pending} | {status:ready,...}
        (polls every 1.5s, max 30s, then shows fallback if still pending)
mobile: renders 3-panel UI when ready
```

**Feedback job:** one `gpt-4o` call (not gpt-4o-mini — quality matters for pedagogy; cost ~$0.01/session is fine at $1k MRR target). Prompt summarized:

> Given a language-learning conversation transcript, produce structured JSON with three lists:
>
> - **highlights** (1–3 items): things the student said well. For each: `phrase` (target language) + `why` (why it works, in the student's native language).
> - **corrections** (1–3 items): clear mistakes worth fixing. For each: `you_said` + `better` + `explanation` (1 sentence, in native language).
> - **vocab** (3–8 items): new words and expressions worth remembering. For each: `term` (target language) + `translation` (native language) + `source_phrase` (the exact sentence from the conversation).
>
> Rules:
>
> - If uncertain about a grammar rule, omit rather than fabricate.
> - Prefer items that came from THE STUDENT'S speech over the coach's.
> - All counts are upper bounds — if there's nothing of substance to say, return fewer items.

Validated against `SessionFeedbackSchema` (Zod) before save. On parse failure, log to Sentry, status = `failed`, mobile shows fallback ("Couldn't generate feedback this session — try another conversation").

**Free vs Pro split for feedback:**

|                                                                              | Free | Pro |
| ---------------------------------------------------------------------------- | ---- | --- |
| Generate feedback for the just-ended session                                 | ✓    | ✓   |
| View feedback for sessions older than the last 3                             |      | ✓   |
| Audio playback of correction phrases (re-renders the `better` field via TTS) |      | ✓   |
| Weekly progress email digest (gpt-4o-mini summarizer + Resend)               |      | ✓   |

Every free user sees the coaching payoff once per session — that's the funnel hook. History past 3 sessions is Pro; audio of corrections is Pro (incremental TTS cost of ~$0.003/correction × ~3 corrections × N reviews per session = pennies/Pro user/mo).

**UI:** new mobile component `EndOfSessionSheet`. Slides up from bottom when user ends a session. Three accordion panels:

```
┌──────────────────────────────────┐
│  Great job!                      │
│  You spoke for 7 min 23 sec      │
│  ────────────────────────────    │
│  ✨ What you nailed              │
│   ▾ "Hai voglia di mangiare?"   │
│      Natural verbs for talking   │
│      about hunger. Nice!         │
│  ────────────────────────────    │
│  📝 Things to polish             │
│   ▾ You said "io andato"        │
│      Better: "io sono andato"    │
│      In Italian, motion verbs    │
│      use "essere" (to be).       │
│  ────────────────────────────    │
│  📚 Worth remembering            │
│   ▾ ho fame  →  I'm hungry      │
│   ▾ panino   →  sandwich        │
│   ▾ delizioso → delicious        │
│  ────────────────────────────    │
│  [Done]    [Try another]         │
└──────────────────────────────────┘
```

Styling: matches existing Sunrise palette (peach/cream/coral); inline `StyleSheet.create({...})` per the project convention.

### Role-play — scenarios that solve "what should I talk about?"

**Catalog:** static, in `packages/shared/src/role-play-scenarios.ts`. Bruno's confirmed 10:

| ID             | Title                                      | Locale flavor           | Free? |
| -------------- | ------------------------------------------ | ----------------------- | :---: |
| `coffee`       | Ordering coffee or food at a café          | Casual                  |   ✓   |
| `hotel`        | Checking into a hotel                      | Polite formal           |       |
| `directions`   | Asking for directions in a city            | Stranger small-talk     |   ✓   |
| `doctor`       | Doctor visit — symptoms and medications    | Polite                  |       |
| `interview`    | Job interview                              | Formal, register tested |       |
| `party`        | Small talk at a party                      | Casual, with twists     |   ✓   |
| `complaint`    | Customer-service complaint                 | Assertive               |       |
| `phone-friend` | Phone call with a friend                   | Casual, fast            |       |
| `meeting`      | Workplace meeting introduction             | Polite professional     |       |
| `emergency`    | Lost passport / wallet — police or embassy | Stressed formal         |       |

Each scenario object:

```ts
type RolePlayScenario = {
  id: string;
  title: { en: string; fr: string /* ... all 12 supported native langs */ };
  description: { en: string; fr: string /* ... */ };
  systemPromptFragment: string; // appended to coach prompt
  coachOpeningLine: (lang: TargetLang) => string; // first line per target lang
  twists: string[]; // 2-3 mid-conversation pivots the coach can trigger
  pro: boolean; // false for the 3 free scenarios
};
```

**Free vs Pro split:** 3 free (coffee, directions, party) — easiest entry points + high replay value. 7 Pro. Locked scenarios show in the picker with a lock icon and tap → paywall.

**Flow change:** new `POST /v1/sessions/start` endpoint (or extend the existing session-start path — TBD by writing-plans skill, depends on what's already there) accepts `{ scenarioId?: string }`. When provided:

1. Server looks up scenario, validates the user is entitled to it (free scenarios free; Pro scenarios gated).
2. `buildCoachSystemPrompt` includes the `<scenario>` block in addition to (or replacing — TBD) the memory block.
3. Coach's first message is `scenario.coachOpeningLine(targetLang)` instead of the generic greeting.
4. Coach is instructed to introduce 1 twist after ~5 user turns to keep practice realistic.

**UI:** new modal `(modals)/role-play-picker.tsx` accessible from the Practice tab. Default behavior unchanged (start = free conversation); a "Practice a scenario" button opens the picker.

### Freemium gating + paywall

**Feature-gating module:** new `apps/api/src/lib/features.ts`.

```ts
export const FEATURES = {
  COACH_MEMORY_DEEP: "coach_memory_deep", // weak_areas + personal_context
  FEEDBACK_HISTORY: "feedback_history", // sessions older than last 3
  FEEDBACK_AUDIO: "feedback_audio", // TTS playback of correction phrases
  ROLEPLAY_PREMIUM: "roleplay_premium", // 7 of the 10 scenarios
  WEEKLY_DIGEST_EMAIL: "weekly_digest_email",
} as const;

export async function canUseFeature(
  userId: string,
  feature: keyof typeof FEATURES,
  deps: { db: Db },
): Promise<boolean> {
  const ent = await getEntitlement(userId, deps.db);
  if (ent.plan === "pro" && (!ent.proUntil || ent.proUntil > new Date()))
    return true;
  return false; // all listed features are Pro-only
}
```

Used at every call site that varies behavior between free/Pro. Pure function over the entitlement row — no in-memory cache; one row read per check, fast.

**Daily voice quota** — extend `entitlements` with `daily_voice_seconds_used` + `daily_reset_at`:

```sql
ALTER TABLE entitlements
  ADD COLUMN daily_voice_seconds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN daily_reset_at timestamptz NOT NULL DEFAULT now();
```

Existing `lib/quota.ts` extended with `canUseSecondsDaily`:

- Free: 600 sec/day (10 min). When exceeded, `voice.ts` returns `429 QUOTA_EXCEEDED` and the mobile client shows the paywall.
- Pro: 3600 sec/day soft cap (60 min). When exceeded, return success with a `quota_warning` flag in the response; the mobile client shows a one-time "you've talked a lot today, take a break?" toast. No hard block.
- Daily reset: at the user's local midnight (compute from `profiles.timezone`). Implementation: lazy reset on first check after `daily_reset_at + 1 day in user tz`.

**Pricing (Bruno's confirmed decision):**

- Monthly: $7.99
- Annual: $49.99 (= $4.16/mo equivalent, ~48% discount on annual signal)
- Trial: 7 days, opt-out (Adapty 2025: opt-out trials convert 2.5–3× higher than opt-in)
- No lifetime tier in v1
- No geographic pricing

**RevenueCat configuration** (manual dashboard work, ~30 min walked through with Bruno):

- Project: My Language Coach
- Products:
  - `mlc_pro_monthly` — $7.99/mo, 7-day trial, auto-renewing
  - `mlc_pro_annual` — $49.99/yr, 7-day trial, auto-renewing
- Entitlement: `pro` (granted by either product)
- Webhook: `https://my-language-coach-agentical-rebuild.fly.dev/v1/billing/revenuecat` — receives `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE` events; updates `entitlements.plan` and `entitlements.pro_until`.

**Mobile integration:**

- `react-native-purchases` SDK installed and initialized in `_layout.tsx` with the RevenueCat public SDK key.
- New `usePurchases()` hook wraps `Purchases.getCustomerInfo()` and exposes `isPro: boolean`.
- New `(modals)/paywall.tsx` modal: title, three bullets (Memory that remembers you / Full session feedback / All 10 role-plays), monthly + annual buttons (annual labeled "Best value — save 48%"), "Start 7-day free trial" CTA, restore-purchase link, terms/privacy links.
- Paywall triggers: (a) free user hits daily quota, (b) free user taps a Pro feature (locked scenario, feedback history scroll, etc.), (c) Day 7 push notification deep link.

### Push notifications

**Schedule:**

- **Day 1, ~9am user-local time:** "Your first feedback report from your coach is ready." Deep-links to the most recent session's end-of-session sheet (re-renders from the saved `session_feedback` row).
- **Day 2, ~7pm user-local time:** "Ready for a 5-minute warmup with your coach?" Deep-links to the Practice tab.
- **Day 7, ~6pm user-local time:** "Your first week with your coach — here's your summary." Deep-links to a new "Weekly summary" screen (small new screen on the Progress tab that shows session count, total time, top topics, top corrections), with a Pro upgrade CTA at the bottom.

**Infrastructure:**

- Expo Push Notifications via the existing `push_tokens` table (registered in Plan 6).
- Scheduled via a new module `apps/api/src/jobs/push-scheduler.ts`. Cron-style trigger on Fly via the `@scheduled` pattern (or a separate Fly machine job — TBD by writing-plans).
- One row in a new `push_schedule` table per (user, kind, send_at) — created at signup for Day 1/2/7, updated/cancelled if user opens app + interacts with the targeted feature first.
- Deep-link routing in `apps/mobile/src/lib/deep-links.ts` extended for `mylanguagecoach://feedback/:conversationId`, `mylanguagecoach://practice`, `mylanguagecoach://weekly-summary`.

**Permission UX:** existing first-launch flow already requests notification permission. No change needed beyond verifying the prompt copy is appropriate for Pro pitch.

## Data model summary

New tables:

- `coach_memory(user_id, language_code, ...)` — Plan 8
- `session_feedback(conversation_id, ...)` — Plan 8
- `push_schedule(id, user_id, kind, send_at, sent_at, cancelled_at)` — Plan 8

Modified tables:

- `entitlements` — add `daily_voice_seconds_used`, `daily_reset_at`
- `coach_memory` — add `opted_out boolean` for users who skipped consent

Migrations:

- `0010_coach_memory.sql`
- `0011_session_feedback.sql`
- `0012_entitlements_daily_quota.sql`
- `0013_push_schedule.sql`

All RLS policies follow the convention from `0001`: `FOR ALL USING (auth.uid() = user_id)` + `WITH CHECK` on mutating actions.

## Free vs Pro summary (the funnel matrix)

| Capability                                                 |               Free                |         Pro         |
| ---------------------------------------------------------- | :-------------------------------: | :-----------------: |
| Voice conversation                                         |            10 min/day             | 60 min/day soft cap |
| Sessions in history                                        |              last 3               |         all         |
| End-of-session feedback (current session)                  |                 ✓                 |          ✓          |
| End-of-session feedback (history >3 sessions)              |                                   |          ✓          |
| Audio playback of correction phrases                       |                                   |          ✓          |
| Coach memory — basic (name, level, recent topics, summary) |                 ✓                 |          ✓          |
| Coach memory — deep (weak areas, personal context)         |                                   |          ✓          |
| Role-play scenarios                                        | 3 of 10 (coffee/directions/party) |       all 10        |
| Push notifications                                         |                 ✓                 |          ✓          |
| Weekly progress email digest                               |                                   |          ✓          |

## Sequencing — 5 milestones, ~2 days

Each milestone produces an APK Bruno installs and uses on his Android device before the next milestone starts. Test feedback drives any course corrections.

| Milestone | Scope                                                                                                                                                                       | Bruno tests                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**    | `coach_memory` schema + RLS, memory extraction at `/end`, memory injection in `buildCoachSystemPrompt`. No new UI yet.                                                      | Have a conversation. End. Start a new one. Coach mentions something from previous session.                                              |
| **M2**    | Memory consent screen in onboarding. Memory editor under Profile. `session_feedback` schema + generation job + `/sessions/:id/feedback` endpoint. No end-of-session UI yet. | View + edit memory in Profile. Hit `/feedback` endpoint manually (curl or in-app debug button) to see structured feedback JSON.         |
| **M3**    | End-of-session sheet UI (3 panels). Role-play scenarios catalog + picker modal + session-start with scenario.                                                               | Pick "ordering coffee". Do the conversation. See the feedback sheet with real highlights/corrections/vocab. Full coaching loop visible. |
| **M4**    | `features.ts` module, daily quota in `quota.ts`, `react-native-purchases` integration, paywall modal, RevenueCat dashboard config (manual), webhook endpoint.               | Switch sandbox between free / Pro. Hit quota → paywall. Tap subscribe (sandbox) → Pro flag flips → previously-locked features unlock.   |
| **M5**    | Push scheduler + Day 1/2/7 jobs, AI disclaimer in onboarding, GDPR consent text update, Play Console screenshots + description, internal-track build submitted.             | Day 1 push arrives next day. Internal-track APK installs from Play. App passes Google's app-review checks.                              |

## Confirmed decisions (Bruno, 2026-05-30)

- **Pricing:** $7.99/mo + $49.99/yr + 7-day opt-out trial.
- **Free-tier memory depth:** basic free (name/level/recent topics/summary); deep memory (weak areas + personal context) Pro-only.
- **Memory scope:** per-language. Italian + Spanish = two isolated memory rows.
- **Role-play scenarios:** the 10 in the catalog above; 3 free (coffee, directions, party); 7 Pro.
- **Memory consent skip:** disables memory write + read only. End-of-session feedback STILL works for users who skip consent (transcript already saves to `messages` for the conversation to function). Privacy policy spells this out.
- **Weekly summary screen:** included in M5. Day 7 push deep-links into it.

## Open questions (resolved during writing-plans / code exploration — not blocking spec approval)

1. **Session-start endpoint path:** does Plan 4/6 already have a `POST /v1/sessions/start` endpoint, or does session start happen implicitly inside `/v1/voice/turn`? If the latter, we add an explicit start endpoint in M3.
2. **RevenueCat webhook signature verification:** RevenueCat signs webhooks with HMAC — verify signatures in M4 (~30 min extra work) or trust the network and rely on idempotency. (Vote: verify.)
3. **Push scheduling backend:** Fly cron is the natural fit but Plan 7 may not have set it up. If not present, `push-scheduler` runs as a long-lived process polling `push_schedule` every minute.

## Verification

End-state Plan 8 ships when:

- All M1–M5 acceptance criteria pass on Bruno's Android device.
- API tests: at minimum new module unit tests for `extractMemory`, `generateFeedback`, `canUseFeature`, daily quota check. CI green.
- One real end-to-end on-device cycle: install internal-track APK → onboard → sign in → memory consent → 5-min Italian conversation → see feedback sheet → start new session → coach references prior topic → pick role-play → run paywall → tap subscribe in sandbox → Pro unlocks → receive Day 1 push the next morning.
- Internal-track build live on Play Console with RevenueCat sandbox subscriptions purchasable.
- Memory deletion verified via Profile (delete one language memory; confirm row gone in DB).
- Account deletion still works end-to-end with the new tables (`coach_memory`, `session_feedback`, `push_schedule` all cascade on user delete — included in the deletion routine update task in M2).

## Next step

If this spec is approved, I invoke the writing-plans skill to produce the concrete task-by-task implementation plan, then Milestone 1 implementation starts.
