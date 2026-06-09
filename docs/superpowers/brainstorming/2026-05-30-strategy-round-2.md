# Strategy & Product Bets — Round 2 (deeper grounding)

_Bruno asked for a deeper, slower think than the Round 1 draft (2026-05-29). This is it._

_The Round 1 doc lives at `2026-05-29-strategy-and-product-bets.md` in this folder — it stands as an earlier draft. This document supersedes it. A French translation is at `2026-05-30-strategy-round-2-fr.md`._

---

## Context

You have shipped Plans 1–7 of a greenfield rebuild of My Language Coach (Expo SDK 54 + Hono + Supabase, dev build live on your Android device, Plan 7 visual identity polish complete). You want to:

1. Honestly assess whether there's any real commercial potential for this app in the 2026 AI-conversation-coach market — not "is it possible" but "is it probable, and what's the realistic shape of success vs. failure?"
2. Decide what Plans 8 / 9 / 10 actually ship, in what order, with what monetization
3. Get to a Play Store + App Store launch fast (Play deadline 2026-07-04 looms)
4. Avoid burning weeks on the wrong bets

Round 1 of this analysis was "a little fast." It made confident pricing and competitor claims without sourcing. It under-counted the technical work in Plan 8. It under-stated competitive headwinds (specifically the Babbel Speak free AI launch that I missed). This round fixes those gaps by grounding every claim in two parallel investigations:

- A **technical-reality investigation** that read the actual code paths, schemas, and existing Plan documents
- A **market-intelligence investigation** that pulled 2026 pricing, funding, adoption, and conversion data from 40+ sources

Each major claim below is sourced or labeled as inference.

---

## How this round differs from Round 1

| Round 1 said                                                 | Round 2 corrects to                                                                                                                                            | Why it matters                                                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speak is ~$14.99/mo                                          | **Speak is $20/mo or $99/yr** (Series C 2024-12, $1B valuation, 10M users, 4.8★ iOS)                                                                           | The market price ceiling for "premium AI coach" is higher than I assumed; $9.99 is comfortably mid-market, not undercutting                                                                  |
| Competition is "Speak / Talkpal / Praktika / ELSA"           | **Add Babbel Speak (free, launched Sept 2025) and Duolingo's expanding AI features**                                                                           | Two well-resourced incumbents are now giving away the conversation feature for free or near-free as part of existing subs. Indie can't compete on "AI conversation" as a standalone offering |
| Duolingo Max is the AI-premium reference                     | **Duolingo Max has only 9% adoption** after 2+ years, growing slowly                                                                                           | Strong signal that "AI voice" alone is not worth premium pricing to consumers. Reframes our differentiation requirement                                                                      |
| Free→paid conversion 1–3% indie / 5–8% best-in-class         | **Trial-to-paid 38–54%, overall download-to-subscriber 1.7%** (RevenueCat 2025 data across thousands of apps)                                                  | The funnel math is different from what I quoted — the action is in the trial conversion, not the broad install→paid jump                                                                     |
| Speak burns ~$300 CAC                                        | **Likely $15–30 mixed-channel; $30–50 paid-only**                                                                                                              | The "indie can't compete" frame is partly true but exaggerated. Paid channels are still expensive but not five-figure-CAC catastrophic                                                       |
| Variable cost ~$0.025/min                                    | **API alone $0.025/min, with infra/storage/profit margin $0.05–0.10/min user-facing**                                                                          | My margin math was rosy. At $10/mo with a heavy user (60 min/mo), gross margin is ~30%, not the ~70% I quoted                                                                                |
| "Coach memory + feedback + role-play = clear differentiator" | **Still true, but ChatGPT Voice memory rollout is a watch-item** — currently no per-language voice persistence, but OpenAI is rolling memory broadly           | Differentiator window is real but not unlimited. Time is a factor                                                                                                                            |
| Plan 8 = ~3-4 weeks                                          | **Plan 8 = 4-5 weeks** based on technical reality (no provider abstraction, no feature-gating logic, no memory/feedback/scenario scaffolding — all greenfield) | Time honesty matters for burnout management. Don't pre-promise 3 weeks then slip                                                                                                             |
| Account deletion is "a parallel concern"                     | **Account deletion is a HARD BLOCKER for App Store submission** — currently in flight on the `worktree-account-deletion` branch                                | Plan 8 spec can be drafted in parallel but Plan 8 implementation cannot start until account deletion merges                                                                                  |
| Vocab card game needs full table design                      | **`vocab_items` table already exists** with `userId, language, term, translation, firstSeenMessageId, mastery` — Plan 9 has a real head start                  | Plan 9 estimate can drop from 4 weeks to 3                                                                                                                                                   |
| Entitlements gating "just needs wiring"                      | **Entitlements has `plan` field but ZERO feature-gating logic wired** — voice-second quota only. Building feature-gating is a real Plan 8 task                 | Adds 3–5 days to Plan 8 estimate                                                                                                                                                             |
| Provider TTS swap "easy"                                     | **Direct function calls, no strategy pattern** — swapping TTS for Pro tier requires a refactor task before Plan 10                                             | Move that refactor into Plan 8 as Task 1, or live with OpenAI TTS through Plan 9                                                                                                             |

---

## Findings — Technical reality (grounded in code)

These are the ground-truth findings I needed before recommending anything.

### Voice loop is production-ready and ready to be extended

- **Session-end endpoint:** `apps/api/src/routes/voice.ts:345-418` — `POST /sessions/:id/end` verifies ownership, computes wall-clock duration, upserts streak, returns `{ seconds_spoken, goal_reached }`. The right hook point for memory-extraction and feedback-generation calls.
- **SSE protocol** in `apps/api/src/routes/voice.ts:163-342` ships `transcription` / `reply-chunk` / `done` / `error` events. The `done` payload is currently `{ messageId, userMessageId }` — too lean to carry feedback. Decision: feedback gets its own endpoint, not jammed into the SSE stream. (`POST /sessions/:id/feedback` polled by the mobile client when the session-end sheet opens, or returned in the `/end` handler response.)
- **Coach system prompt builder:** `packages/shared/src/prompts.ts:8-23` (`buildCoachSystemPrompt`) currently takes `{ targetLanguage, userDisplayName }`. Extending to `{ ..., memory?: CoachMemory }` and conditionally injecting an `<context>...</context>` block is the cleanest path. **No memory placeholder exists yet** — all greenfield.

### Database schema status

Current schema (from migrations 0000–0009):

| Table           | Purpose                                                              | Plan 8/9/10 use                            |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `profiles`      | userId, displayName, langs, dailyGoalMinutes, timezone               | Memory editor lives here (Plan 8)          |
| `conversations` | id, userId, language, topicId, startedAt, endedAt, secondsSpoken     | Feedback FK target (Plan 8)                |
| `messages`      | id, conversationId, role, text, translation, audioStoragePath        | Vocab extraction source (Plan 9)           |
| `vocab_items`   | id, userId, language, term, translation, firstSeenMessageId, mastery | **Already exists — Plan 9 head start!**    |
| `entitlements`  | userId, plan (free/pro), proUntil, monthlyVoiceSecondsUsed           | Needs feature flags + daily quota (Plan 8) |
| `usage_events`  | userId, platform, provider, operation, units, costUsd, rateCardId    | Already wired; new SKUs slot cleanly       |
| `rate_cards`    | Versioned $/unit per provider operation                              | Already supports Pro-tier TTS SKUs         |

Missing for Plan 8:

- `coach_memory` (per-user, per-language, structured profile)
- `session_feedback` (per-conversation, structured 3-panel JSON)
- A migration to extend `entitlements` with feature flags or replace plan-only check with a feature-gating module

### RLS pattern is consistent

From `0001_rls_policies.sql:12-58`: standard direct-owned pattern (`USING (auth.uid() = user_id)`) plus nested pattern (`USING (EXISTS (SELECT 1 FROM conversations ...))`) for messages. **Critical reminder from your memory:** UPDATE policies need BOTH `USING` and `WITH CHECK` clauses or updates silently affect 0 rows. Apply to new tables consistently.

### Entitlements module is voice-quota-only

`apps/api/src/lib/quota.ts:13-29` checks `plan + proUntil` against `monthlyVoiceSecondsUsed`. **No feature-gating logic exists yet.** Plan 8 must build:

1. A feature-gating module (`canUseFeature(userId, feature)`) that wraps entitlement lookup
2. Feature constants (`COACH_MEMORY`, `DEEP_FEEDBACK`, `ROLE_PLAY_PREMIUM`, etc.)
3. A daily-quota wrapper for free tier (10 min/day talk, 3 role-plays/day, etc.)

This is 3–5 days of work on its own.

### Mobile architecture for new screens

- Routes: `(auth)/`, `(onboarding)/`, `(tabs)/` (home, practice, progress, profile). No vocab, library, or memory routes.
- Styling: **Confirmed — every screen uses inline `StyleSheet.create({...})`**, not NativeWind. Don't fight this — match the pattern.
- Design tokens at `packages/design-tokens/src/colors.ts:1-31`: Sunrise palette (peach/coral/mauve/accent/ink/cream/danger/glass/shadowTint) with sunrise/warmth/glow gradients. **No dark-mode variant.**
- **Decision:** the vocab card game gets an isolated dark palette scoped to the game component. Don't pollute global tokens until we know we want a global dark theme.

### Plan structure pattern (mirror it)

The existing plans (`auth-social-and-password-reset`, `cost-revenue-dashboard`, `universal-links-email-verification`, `account-deletion`) all follow this shape:

1. Goal sentence (1–2 lines)
2. Architecture paragraph
3. Tech stack section
4. File structure overview (new / modified / out-of-band)
5. Numbered task breakdown — atomic 1–2h tasks, each with: scope comment, files, `- [ ]` checklist, code-ready snippets, run/test/commit step
6. Conventions section per-plan

Plans 8/9/10 specs and plans should match exactly. Don't innovate on plan structure.

### Provider abstraction is direct, not strategy-pattern

`apps/api/src/providers/{openai,deepgram,elevenlabs}.ts` export factory + operation functions. There's no interface layer to swap TTS based on entitlement. **Implication:** if Plan 8 wants Pro-tier premium TTS (Inworld 1.5 Max or Gemini 3.1 Flash), Task 1 of Plan 8 is a small TTS-provider-strategy refactor. Alternative: defer and ship Plan 8 with single TTS, refactor in Plan 10.

### Account deletion blocks Plan 8

In flight on `worktree-account-deletion`. Last commit on main: `4ffa0e1 fix(mobile): delete-account sheet renders correctly on iPad` (May 29). **Plan 8 spec drafting can run in parallel; Plan 8 implementation cannot start until this merges.** Recommendation: brainstorm Plan 8 spec while finishing the deletion plan.

### Zero existing scaffolding for memory / feedback / role-play

Grep confirms: no `coach_memory`, no `session_feedback`, no `role_play` / `scenario` code. Vocab is the lone head start. This is good news (no debt) but means realistic estimates are not "extend X" but "build from scratch."

### Cost recording integration is clean

Fire-and-forget pattern via `onUsage` callback (`apps/api/src/lib/usage-bridge.ts`). Adding new operations (memory extraction at gpt-4o-mini, feedback at gpt-4o, premium TTS) is a matter of inserting a callback at the call site + updating `rate_cards`. No refactor needed.

---

## Findings — Market reality (grounded in 2026 data)

### The category sizes up like this

- **Global digital language learning market:** $21.06B in 2025 → projected $24.39B in 2026 → $50.82B by 2031 (CAGR 15.83%) — Mordor Intelligence, Business of Apps
- **App-based revenue subset:** $1.54B in 2025, 18.8% YoY growth — Business of Apps
- **327M downloads in 2025** — LingoBright
- AI features have shifted from differentiator to **table stakes**: 60%+ of platforms ship some AI-conversation feature by 2026

The market is real. The category is still expanding. **But:** Duolingo controls 67% of app revenue and the rest is fragmented across well-funded competitors. The "easy" indie slot — pure AI conversation — is closed.

### Competitor landscape (verified 2026 pricing & traction)

| Competitor         | Monthly            | Annual ($/mo equiv.) | Funding / scale                        | Notable feature                             | Indie takeaway                                               |
| ------------------ | ------------------ | -------------------- | -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| **Speak**          | $20                | $99 ($8.25/mo)       | $162M raised, $1B val, 10M users, 4.8★ | OpenAI Realtime API integration             | Owns "premium AI conversation"; out of reach                 |
| **Duolingo Max**   | $29.99             | $168 ($14/mo)        | 12.2M paid (Duolingo total), Max=9%    | Video Call + Roleplay                       | **Premium AI tier is failing at adoption** — Tier signal     |
| **Babbel Speak**   | Free w/ Babbel sub | Babbel ~$7.45-15/mo  | Established brand, ~$383M revenue 2024 | **Free AI conversation since Sept 2025**    | **Direct headwind — incumbents now bundle AI free**          |
| **Talkpal**        | $9.99              | $59.88 ($4.99/mo)    | 5M+ users, undisclosed funding         | Free tier 10 min/day                        | Closest direct comp; price-aggressive                        |
| **Praktika**       | $8                 | No month-to-month    | Undisclosed; 4.7★ stores               | Multimodal — upload photos/videos for convo | Interesting feature angle worth noting                       |
| **ELSA Speak**     | $13.33             | $159.99 ($13.33/mo)  | Series C; **2.7★ Trustpilot** (poor)   | Phoneme-level pronunciation                 | Pronunciation moat real but ELSA brand damaged               |
| **Loora**          | $10                | $119.99 ($10/mo)     | Undisclosed                            | Professional/corporate focus                | B2B niche; not direct competitor                             |
| **Univerbal**      | $10-15             | $90 ($7.50/mo)       | Rebrand of Quazel                      | Conversational fluency emphasis             | Real comp at our exact price band                            |
| **Talkio AI**      | $10                | $9/mo annual         | Undisclosed                            | **40+ langs, 134 dialects, 400+ tutors**    | **Owns "breadth" — that lane is closed**                     |
| **Lingoda Sprint** | $89-139            | n/a                  | Established, live instruction          | Live classes + cashback structure           | Different product — premium human-tutor                      |
| **ChatGPT Voice**  | $20 (Plus)         | n/a                  | OpenAI                                 | Free with Plus sub                          | **The real floor — your bar is "what does ChatGPT NOT do?"** |

Sources: Beginners in AI, ICanLearn, Getlatka, Lucidity Insights, Talkpal Pricing, Trustpilot, DigitalAdGenius, Practice Me, Talkio.ai blog.

### The two most important signals

1. **Duolingo Max at 9% adoption** after 2+ years means the consumer market has answered the question "would you pay $30/mo extra for AI voice features bolted onto Duolingo?" and the answer is overwhelmingly **no**. AI conversation alone — even with a category-leader brand and 52.7M DAU at the top of the funnel — is not a premium-tier feature. **This reshapes what we should sell.** The "AI conversation" line item must be packaged inside a broader value story (coaching, vocabulary mastery, pronunciation progress) that the user understands as continuous improvement, not as "AI."

2. **Babbel Speak is now free** as part of Babbel's existing sub (launched September 2025). This is the most underestimated competitive change of the year. Babbel was the "structured course" anchor — they're now bundling AI conversation in for free. Their incumbency + content depth + brand + bundled-AI is a real headwind for any standalone "AI conversation" pitch. **Our offer cannot be "pay $10 for AI conversation" — that gets crushed.** It has to be "pay $10 for a complete coaching system that uses AI as the engine."

### Conversion / churn benchmarks

- **Trial-to-paid (freemium with trial):** 38–54% — Adapty
- **Overall download-to-subscriber:** 1.7% — RevenueCat 2025 data
- **Trial conversion (download → trial start):** 3.7–8.9% — Adapty
- **Education app churn:** >95% by day 30 (median); >50% by day 7
- **Healthy retention target:** 40%+ at 90 days, <5% monthly churn — Business of Apps
- **iOS vs Android conversion:** education category roughly Android 27% / iOS 25% page-to-install, iOS skews higher revenue/install in subscription categories

What this means for our launch math:

- 1000 installs / month × 7% download→trial × 45% trial→paid = ~32 paid sub/month
- 5000 installs / month × 7% × 45% = ~160 paid sub/month — break-even and then some
- **The bottleneck is the trial start, not the trial conversion.** The product has to make people WANT to start a trial within minutes of opening it.

### CAC reality

- Industry organic-CAC target for healthy language apps: $15. Paid-channel CAC: $30–50+. Some sources project $1500 cumulative CAC at maturity for category leaders.
- Speak's mixed CAC (raised funding / total users) likely sits at **$15–30**, not the $300 I quoted yesterday.
- ATT opt-in rates: 13.85% trough (mid-2024) → ~35–50% globally Q2 2025. Improving but still hostile to paid attribution.
- **Indie reality:** paid UA is real but financially fragile. A $20 CAC at $10 monthly ARPU + 30% store cut = $7 contribution × 5 months = $35 LTV. CAC payback ~3 months. Sustainable only if churn is low.
- **Founder-driven organic** (YouTube, TikTok, Reddit, X/Bluesky) is the indie path. Real, but slow. Plan ~6 months of consistent content before meaningful traction.

### Geographic split

- LATAM/Brazil ($69.7M, 17% CAGR) and Turkey ($5.6M, 16.2% CAGR) are fastest growing — Cognitive Market Research
- iOS skews EU/US revenue; Android skews India/Brazil/SEA volume
- **No major competitor offers geo-discounted pricing**. Opportunity exists in low-GDP markets but with cross-border arbitrage risk. Probably skip in v1.

### Bruno-specific outcome probabilities (18 months, given the data)

This is the bit that matters most. Given current product state, single-founder bandwidth, no funding, and assuming the launch is done with **niche positioning + founder content + freemium $7.99–$9.99 pricing:**

| Target       | Probability | What it requires                                                                    |
| ------------ | ----------- | ----------------------------------------------------------------------------------- |
| **$1k MRR**  | **40–50%**  | Clear niche + 6 months of consistent founder content + 7-day trial + 1k subscribers |
| **$10k MRR** | **10–15%**  | Above + paid UA efficiency OR viral moment OR pre-existing audience of 30k+         |
| **$50k MRR** | **<5%**     | Likely requires capital or acquisition path                                         |

These probabilities are not predictions, they're priors based on indie SaaS broadly (30% of solo devs reach $1k MRR in 12 months — Indie Hackers benchmark) adjusted for category-specific competitive friction.

**The Bruno question this forces:** is $1k–$10k MRR a worthwhile outcome for you given the time investment? If the honest answer is "no, I need $10k+ to make this worth it," then the path requires either pre-built audience or pivoting to a niche where indies have outsized leverage. If "yes, $1k–5k MRR + the craft + the optionality is enough," then proceed with the plan below.

### What ChatGPT Voice still doesn't do (2026)

- No per-session persistent memory across language-coach use
- No structured curriculum
- No spaced repetition / vocab tracking
- No conversation transcript with corrections
- No progress visualization
- No targeted weak-area drilling

**These remain the differentiator surface.** None are technically out of reach for OpenAI — but they aren't shipped. The window is real but won't last forever; OpenAI's "memory" rollout is something to watch monthly.

---

## Strategic recommendations

### 1. Reposition: not "AI conversation app" — "coaching system that uses AI"

Don't sell what's commoditized (the AI voice). Sell what isn't (the loop that wraps it).

The pitch becomes: **"Your coach remembers you, gives you feedback after every conversation, builds a vocabulary deck from your real conversations, and shows you progress over weeks. ChatGPT Voice does none of these. Babbel Speak does none of these either."**

This is the only positioning that survives the Babbel-Speak-is-free competitive shift. If we sell "AI conversation," Babbel customers don't switch. If we sell "the coaching loop," Babbel customers are intrigued by something Babbel doesn't have.

### 2. Pick a niche persona for the launch story (everything else stays generic)

The product remains 12-language general-purpose. **The launch story is narrow.** Without this, organic acquisition is dead — there's no compelling reason for anyone to share, blog, or post about a generic "AI language coach."

Three candidate positionings, evaluated:

- **A. "AI conversation coach for engineers / remote workers learning Italian/Spanish/French/German for relocation"** — your own profile, easy to write copy from, niche fits your audience overlap with dev Twitter / r/digitalnomad. **My recommendation.**
- **B. "AI English coach for non-native engineers preparing for interviews"** — bigger TAM, harder content angle (English-specific, less fun for you to use), more direct ELSA/Loora competition
- **C. "AI Italian coach for English-speakers planning to move to Italy"** — narrowest, easiest content, smallest TAM but tightest message-market fit

Recommendation: **A**, with B as fallback if A doesn't trend. Defer **C** unless you discover Italian-specific traction.

### 3. Pricing: $7.99/mo, $49.99/yr ($4.16/mo eq.), 7-day trial

Calibrating downward from yesterday's $9.99 based on the data:

- $7.99/mo is **below** Talkpal monthly ($9.99) but above Praktika ($8) — psychological "under $10" anchor
- $49.99/yr (~$4.16/mo) is a steep 50% discount on annual — strong trial-to-annual signal
- 7-day free trial (opt-out — automatic conversion to paid unless canceled) — 2.5–3× higher conversion than opt-in trials per Adapty
- Skip lifetime tier in v1 — locks in a price floor you may regret if upmarket
- **Geographic discounts:** skip in v1; reassess at 1k users if Brazil/India/Turkey shows volume

Margin at $7.99/mo:

- Apple/Google cut: 30% Y1 → $5.59 net
- Variable cost typical Pro user (60 min/mo conversation): $3.50–6 at $0.05–0.10/min user-facing
- Contribution margin: $0–2/user/month for heavy users, $3–5 for light users
- **Tighter than yesterday's analysis suggested.** Implication: soft daily cap on Pro (60 min/day) is not optional — it's required margin protection.

This is a real downward revision and worth flagging. The $9.99 was based on outdated cost assumptions. $7.99 is more competitively positioned AND closer to the cost reality.

### 4. Free tier: deliberately limited but useful

- **Voice:** 10 min/day (matches Talkpal exactly, no need to innovate here)
- **Sessions in history:** last 3 only (drives upgrade for users who want to track progress)
- **Role-play:** 3 free scenarios from the catalog of 10 (coffee/directions/small-talk — the easiest entry points)
- **Memory:** **Basic memory IS free** (name, recent topics, level). Critical — without this, free experience feels cold and won't convert. Locking memory entirely behind Pro kills the funnel.
- **Feedback:** End-of-session feedback is **free** for the current session. History (>3 sessions back) is Pro. This way every free user sees the coaching payoff once.
- **Vocab card game (Plan 9):** 10 cards/day, single mode (voice translate only — the most viscerally satisfying)
- **Pronunciation scoring (Plan 10):** Pro only — 100% upgrade signal

### 5. Distribution channel: pick ONE — recommendation YouTube

Round 1 said "TikTok / Reddit / Twitter / YouTube — pick one." The market data reinforces this is the most important decision. New analysis:

| Channel            | Fit for Bruno                                                                                                    | Realistic 6-month outcome                              | Effort/week |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------- |
| **YouTube**        | High — long-form fits engineer/coach niche, search-driven evergreen traffic, founder build-in-public angle works | 500–2000 subs, 50–200 organic installs/week by month 6 | 8–12h/week  |
| **TikTok / Reels** | Medium — younger audience, harder to monetize at TAM, high variance                                              | 0–5000 followers, viral upside if you hit              | 6–10h/week  |
| **Reddit**         | High — r/languagelearning (2.7M) + niche subs, very high trust                                                   | 50–300 organic installs over 6 months from posts       | 3–5h/week   |
| **X / Bluesky**    | Medium — dev Twitter overlap, build-in-public works                                                              | 200–1000 followers, indirect installs via dev networks | 3–5h/week   |

**Recommendation: YouTube as primary + Reddit as adjacent.** YouTube content (5-10 min videos: "I built an AI Italian coach, here's what week 4 looks like" / "Why I switched from Babbel to my own app" / "Building a language app with Supabase + Expo SDK 54") is evergreen, search-discoverable, and matches the build-in-public energy of your existing devblog instinct. Reddit is low-cost adjacent — share the video, answer technical questions, never spam.

**Commit:** one YouTube video per week for 26 weeks (one per fortnight if 26 weeks is too much). The content output is half the launch strategy.

### 6. Lead with retention, not acquisition

Education apps churn 95%+ by day 30 (Business of Apps). Acquisition without retention is a hole. Priorities for v1:

- **First-session experience:** user must feel they got something valuable in 90 seconds. The opening sentence the coach speaks matters more than any other line of code.
- **Day 1 push:** "Your first feedback report is ready." Concrete, valuable, opens the feedback screen.
- **Day 2 push:** "Ready for a 5-minute warmup with your coach?" Habit cue.
- **Day 7 push:** "Here's your first weekly summary" — concrete progress, real numbers, gentle Pro upsell.
- **Day 14 churn-rescue:** "Want me to remind you about what you learned last time?" — leverages memory.
- **Streak insurance:** 1 freeze per week free, unlimited Pro.

Retention features have higher leverage per hour than feature additions. Prioritize accordingly.

### 7. Sequence: spec Plan 8 now, ship Plans 8/9/10 in 4-4-3 weeks

- **Now → ~2 weeks:** account-deletion ships. Plan 8 spec drafting happens in parallel.
- **Weeks 2–7:** Plan 8 implementation ("The Coaching Loop"). 4–5 weeks honest estimate. End: paid launch.
- **Weeks 7–11:** Plan 9 ("The Vocab Loop"). 4 weeks. End: card game shipped, retention loop measurable.
- **Weeks 11–14:** Plan 10 ("The Pronunciation Loop"). 3 weeks (less new infra). End: Pro-tier signature feature.
- **Throughout:** weekly YouTube video, weekly Reddit + Twitter presence.

---

## Plan 8 — "The Coaching Loop" (4–5 weeks)

**Goal:** ship a paid-allowed app with the three features that make us not-Babbel and not-ChatGPT-Voice: persistent memory, end-of-session feedback, role-play scenarios — plus paywall, push, and freemium quotas.

### Architecture

- **Memory:** new `coach_memory` table (per user, per language), structured profile (recent topics, level, weak areas, personal context, last session summary). Write path: `voice.ts /end` calls gpt-4o-mini to merge existing memory with new transcript → upsert. Read path: `streamChatCompletion` calls `buildCoachSystemPrompt` with optional memory block; coach prompt builder injects a `<context>` paragraph if memory present.
- **Feedback:** new `session_feedback` table (per conversation). Write path: `voice.ts /end` returns synchronously after writing, OR async via a `POST /sessions/:id/feedback` endpoint that mobile polls when the end-of-session sheet opens. Single gpt-4o call with full transcript → structured JSON (highlights / corrections / vocab) → Zod validation → store. Reading: same endpoint returns the row.
- **Role-play:** static catalog in `packages/shared/src/role-play-scenarios.ts` (10 scenarios, each a system-prompt template + 2-3 "twists"). New `POST /sessions/start` endpoint accepts `scenarioId` (optional); coach prompt is built from scenario template instead of default greeting.
- **Feature gating:** new `apps/api/src/lib/features.ts` module wrapping entitlement lookups. Functions: `canUseFeature(userId, feature)` and `getDailyQuota(userId, feature)`. Used at: end-of-session feedback gate (free = current session only), role-play picker (free = 3 scenarios), memory depth (free = basic / Pro = deep).
- **Daily quota:** extend `entitlements` schema with `dailyVoiceSecondsUsed` + `dailyResetAt` (or compute from `usage_events`). Add 10 min/day cap for free, 60 min/day soft cap for Pro.
- **Paywall:** RevenueCat + react-native-purchases. iOS + Android consumable subs ($7.99/mo, $49.99/yr). Paywall screen modal, triggered on quota exceed, on Pro feature tap, or on day 7.
- **Push notifications:** Expo Push, scheduled jobs in `apps/api/src/jobs/`. Day 1, 2, 7, 14 notifications per user state. Use the existing `push_tokens` table.

### Tech stack additions

- `revenuecat/react-native-purchases` (mobile)
- No new server deps; reuse openai + supabase + drizzle

### Task outline (mirroring existing plan pattern)

Aim: 12–14 atomic tasks, 1–2h each. Honest 4–5 week duration.

1. **Schema migrations** — `coach_memory`, `session_feedback`, extend `entitlements`, RLS policies
2. **Feature-gating module** — `lib/features.ts`, types, unit tests
3. **TTS-provider abstraction refactor** (or defer to Plan 10 — Bruno decision) — wrap OpenAI TTS behind interface, add Inworld implementation stub
4. **Memory extraction job** — gpt-4o-mini extraction function, prompt, Zod schema, unit tests
5. **Memory injection** — extend `buildCoachSystemPrompt`, integrate in `streamChatCompletion`
6. **Memory consent UI** — onboarding screen + Profile editor screen for "Your Coach's Memory"
7. **Feedback generation** — gpt-4o call, structured JSON output, Zod schema, endpoint, storage
8. **End-of-session sheet** — mobile UI (3 panels: highlights / corrections / vocab), polls feedback endpoint
9. **Role-play scenarios catalog** — 10 scenarios, prompt templates, picker UI
10. **Role-play session start** — extend session-start endpoint, conversation-prompt path with scenario template
11. **Daily quota enforcement** — wrap voice endpoint, 10 min/day free, 60 min/day Pro soft cap
12. **RevenueCat integration** — entitlements webhook, paywall screen, store identifiers
13. **Push notifications** — Day 1/2/7/14 jobs, message templates, user-timezone scheduling
14. **App Store / Play Console submission prep** — screenshots, descriptions, AI content disclaimer, GDPR consent, account-deletion verification

### Critical files for Plan 8

- `apps/api/src/routes/voice.ts` (extend `/end` handler)
- `apps/api/src/lib/quota.ts` + new `apps/api/src/lib/features.ts`
- `packages/shared/src/prompts.ts` (memory injection)
- `packages/shared/src/role-play-scenarios.ts` (new)
- `apps/api/src/db/schema/coach-memory.ts` (new)
- `apps/api/src/db/schema/session-feedback.ts` (new)
- `apps/api/src/db/schema/entitlements.ts` (extend)
- `apps/api/migrations/0010_coach_memory.sql` (new)
- `apps/api/migrations/0011_session_feedback.sql` (new)
- `apps/api/migrations/0012_entitlements_daily_quota.sql` (new)
- `apps/mobile/app/(tabs)/profile/memory.tsx` (new)
- `apps/mobile/app/(tabs)/practice.tsx` (extend — end-of-session sheet)
- `apps/mobile/app/(modals)/role-play-picker.tsx` (new)
- `apps/mobile/app/(modals)/paywall.tsx` (new)

### What's NOT in Plan 8 (saying no on purpose)

- Vocab card game (Plan 9)
- Pronunciation scoring (Plan 10)
- Real-time gentle correction (Plan 9 or 10)
- Daily auto-generated lesson (Plan 10)
- Speaking confidence chart (Plan 9)
- Streak insurance (Plan 9)
- Multi-region deployment (deferred)
- Geographic pricing
- Lifetime tier
- Referral system

### Definition of done for Plan 8

- App is on Play Store internal track (Production track after stability validation)
- App is on App Store TestFlight (production after Apple review)
- Paywall is wired, RevenueCat is recording, Pro flag flips on purchase
- 5+ test users have completed a session, seen feedback, edited their memory, tried a role-play
- Account deletion is verified working end-to-end on both stores

---

## Plan 9 — "The Vocab Loop" (4 weeks)

**Goal:** the addictive habit loop. Vocab extraction + SRS card game + speaking-confidence chart + streak insurance. This is what doubles session count.

### Architecture

- **Vocab extraction:** `voice.ts /end` adds a gpt-4o-mini call that extracts 5–8 vocab items (term, translation, source-message-id, difficulty, part-of-speech). Inserts into existing `vocab_items` table. Add `next_review_at` + `interval_days` + `ease` columns for SRS.
- **SRS engine:** FSRS algorithm in `apps/api/src/lib/srs.ts`. On card review, compute next interval based on success/fail. Cards due today fetched by `next_review_at <= now()`.
- **Card game:** new `(tabs)/vocab.tsx` route + game screen. Voice translate mode + tap-translate mode for v1 (defer listen-repeat + write to v1.1). Card stack metaphor matching the screenshots Bruno shared.
- **Dark game palette:** scoped to `apps/mobile/components/vocab-game/` component. Don't pollute global tokens.
- **Speaking confidence chart:** widget on progress tab. Reads from existing `messages` table (compute words/min from text + duration over rolling 4-week window).
- **Streak insurance:** simple boolean flag on `streak_days` table — "frozen", consumed on user invocation. Free = 1/week, Pro = unlimited.

### Task outline (8–10 tasks)

1. Schema migration: extend `vocab_items` with SRS columns
2. Vocab extraction at session end (gpt-4o-mini)
3. FSRS algorithm + unit tests
4. Vocab list + cards-due endpoint
5. Card game UI — voice translate mode
6. Card game UI — tap-translate mode + combo / energy meter
7. Speaking confidence chart widget
8. Streak insurance toggle + UI
9. Push notification: "X cards waiting"
10. Paywall integration for unlimited cards

### Critical files

- `apps/api/src/db/schema/vocab.ts` (extend)
- `apps/api/migrations/0013_vocab_srs.sql` (new)
- `apps/api/src/lib/srs.ts` (new)
- `apps/api/src/routes/vocab.ts` (new — list, review, due)
- `apps/mobile/app/(tabs)/vocab.tsx` (new)
- `apps/mobile/components/vocab-game/` (new dir)
- `apps/mobile/components/speaking-confidence-chart.tsx` (new)

### Definition of done for Plan 9

- Avg sessions per active user / week doubles vs. Plan 8 baseline
- 30%+ of active users review at least one card per day
- Pro conversion rate increases by 30%+ relative to Plan 8 launch

---

## Plan 10 — "The Pronunciation Loop" (3 weeks)

**Goal:** the strongest Pro-tier signature. Pronunciation scoring is what gets fence-sitters off the free tier.

### Architecture

- **Pronunciation scoring:** Azure Pronunciation Assessment as v1 provider (best quality, simplest integration). Cost ~$0.02/utterance. Pro-only.
- **Audio storage with consent:** `messages.audio_storage_path` already supports user audio (the schema accepts it). Add `uploadUserAudio` in `voice.ts` next to existing `uploadCoachAudioChunk`. Onboarding consent screen + Profile delete-my-audio button.
- **"Listen to past you":** new screen — week-over-week pronunciation comparison, audio player for each utterance.
- **Daily auto-lesson:** new push notification — "Today's focus: past tense (you struggled with this last week)". Taps into role-play prompt with explicit weak-area focus.
- **Real-time gentle correction:** opt-in toggle in Profile. When on, coach prompt includes "If the user makes a clear mistake, gently correct it inline once every ~5 turns max."

### Task outline (6–8 tasks)

1. Azure Pronunciation Assessment provider integration
2. User audio storage + consent flow
3. Pronunciation score storage + endpoint
4. "Listen to past you" screen
5. Daily auto-lesson push + role-play integration
6. Real-time correction toggle + prompt change
7. Weekly progress email (gpt-4o-mini summarizer + SendGrid or Resend)

### Critical files

- `apps/api/src/providers/azure-pronunciation.ts` (new)
- `apps/api/src/routes/voice.ts` (extend — `uploadUserAudio`)
- `apps/api/src/jobs/daily-lesson-push.ts` (new)
- `apps/mobile/app/(tabs)/progress/pronunciation.tsx` (new)
- `apps/mobile/app/(tabs)/profile.tsx` (extend — correction toggle)

### Definition of done for Plan 10

- 60%+ of Pro users have audio-storage consent
- Free→Pro conversion improves measurably (target: 20%+ improvement vs. Plan 9 baseline)
- 30%+ of Pro users open the pronunciation screen at least weekly

---

## Verification — how we know each phase is working

### Plan 8 launch (Week 7)

- App Store + Play Store live (production tracks)
- 50+ tester installs across iOS + Android
- 5+ paid subscribers within 14 days of public launch
- Crash-free session rate >99.5%
- Account deletion verified working
- Sentry has <1 unique error per 100 sessions

### Plan 9 launch (Week 11)

- Cards-per-day per active user >5 (median)
- Day-7 retention improves by 20% vs. Plan 8 cohort
- Day-30 retention >25% (Plan 8 baseline likely 10–15%)
- Reviews on stores: 4.4+ stars average across 20+ reviews

### Plan 10 launch (Week 14)

- 30+ paid subscribers ($240+/mo MRR)
- Free→Pro conversion of installed users >2%
- 1 piece of YouTube content has >5k views (organic distribution validated)
- Pronunciation feature retention: 30%+ of Pro users use it weekly

### Quarterly check (Month 6)

- $1k MRR — at this point we're in the 40–50% probability band of success
- 5+ honest testimonials from real users
- Burn-rate: net positive month-over-month (revenue > infrastructure + tools)

### Pivot triggers

- **No paid subscribers after 30 days post-launch:** the positioning is wrong. Reposition + relaunch within 2 weeks.
- **Day-7 retention <5% across 100+ users:** the first session experience is wrong. Redesign onboarding + first session.
- **Active free users >500 but Pro conversion <1%:** the paywall placement / value story is wrong. A/B test paywall triggers.
- **YouTube content underperforming after 8 weeks:** swap to TikTok or short-form Reddit content. Don't double down on a channel that isn't producing.

---

## Open decisions for Bruno (resolve before Plan 8 spec)

Ranked by impact.

1. **Niche positioning for launch story.** A (engineers learning Italian/Spanish/French/German for relocation), B (English for non-native engineers in interviews), C (Italian for English-speakers moving to Italy). My vote: A. This decision drives ALL marketing copy, ASO keywords, YouTube content angle, landing page hero.
2. **Pricing.** $7.99/mo + $49.99/yr (Round 2 recommendation), $9.99/mo + $59.99/yr (Round 1), or $5.99/mo undercut. Round 2 data leans $7.99.
3. **Lifetime founders deal.** $99 lifetime for first 200 users, yes/no. New data says skip in v1 — locks in too-low price floor before we know if upmarket is viable.
4. **TTS provider abstraction timing.** Task 1 of Plan 8 (now, ~3 days work, enables Pro-tier premium TTS) vs. defer to Plan 10. Vote: include in Plan 8 — small task, opens Pro tier differentiator earlier.
5. **Feedback delivery mechanism.** Synchronous in `/end` response (~3 sec latency) vs. async via separate endpoint (instant `/end`, polled). Vote: async — better UX, doesn't block the session-end sheet.
6. **Free-tier memory depth.** Basic memory (name, recent topics, level summary) free vs. ALL memory Pro-only. Vote: basic free — free experience without ANY memory feels cold, kills funnel.
7. **YouTube vs other primary distribution channel.** Round 2 vote: YouTube + Reddit secondary. Are you OK with 8–12h/week content investment, or do you want to lean TikTok/short-form?
8. **iOS vs Android launch sequence.** Android first (your dev build already works, Play deadline 2026-07-04 forces this) + iOS 4–6 weeks later (TestFlight then production). Vote: Android first, ride deadline, iOS as Plan 9 milestone.
9. **Pronunciation provider choice.** Azure Pronunciation Assessment (best quality) vs. SpeechSuper (cheaper) vs. ELSA SDK (best brand). Vote: Azure for v1 — quality + integration speed.
10. **Should Plan 8 wait for account-deletion to merge, or proceed in parallel?** Account deletion is the hard blocker for App Store submission. Plan 8 spec drafting can run in parallel; Plan 8 task #1 (schema migrations) can also start in parallel. Plan 8 mobile UI work should wait until deletion merges to avoid merge conflicts on profile.tsx.
11. **Trial length.** 7-day vs. 14-day. Data: 14-day shows ~5% higher trial-to-paid but lower trial-start rate. Net effect ambiguous. Vote: 7-day (standard, less analysis paralysis).
12. **App Store metadata language strategy.** English-only screenshots/descriptions vs. localized into all 12 target languages. Vote: English + top 4 supported langs (Italian, Spanish, French, German) for v1. Localize more later if traction warrants.

---

## Critical files to be modified across Plans 8/9/10 (overview)

**Backend (`apps/api/src/`):**

- `routes/voice.ts` — extend `/end`, add `/feedback`, add `/sessions/start` scenario param
- `lib/quota.ts` — add daily-quota check
- `lib/features.ts` — NEW — feature-gating module
- `db/schema/{coach-memory,session-feedback,vocab,entitlements}.ts` — new + extend
- `providers/openai.ts` — extract gpt-4o feedback call helper
- `providers/azure-pronunciation.ts` — NEW (Plan 10)
- `providers/tts-strategy.ts` — NEW (Plan 8 Task 3 if Bruno greenlights)
- `jobs/{day-1-push,day-7-summary,daily-lesson}.ts` — NEW

**Shared (`packages/shared/src/`):**

- `prompts.ts` — extend `buildCoachSystemPrompt` for memory + role-play
- `role-play-scenarios.ts` — NEW
- `feedback-schema.ts` — NEW (Zod)
- `coach-memory-schema.ts` — NEW (Zod)

**Mobile (`apps/mobile/app/`):**

- `(tabs)/practice.tsx` — extend (end-of-session sheet)
- `(tabs)/vocab.tsx` — NEW (Plan 9)
- `(tabs)/profile.tsx` — extend (memory editor link, correction toggle, audio consent)
- `(tabs)/profile/memory.tsx` — NEW
- `(tabs)/progress/pronunciation.tsx` — NEW (Plan 10)
- `(modals)/paywall.tsx` — NEW
- `(modals)/role-play-picker.tsx` — NEW
- `(onboarding)/memory-consent.tsx` — NEW

**Design tokens (`packages/design-tokens/src/`):**

- Add scoped dark palette for vocab game in Plan 9 — keep Sunrise untouched globally

---

## Honest opinion on the venture

After deeper research and grounding:

**Yes, there's a real if narrow path.** $1k–$10k MRR in 18 months is achievable with the plan above, assuming:

- Niche positioning is picked and committed to
- Founder content runs weekly for 6 months minimum
- Plan 8 ships in 7 weeks (not 4 as originally hoped)
- Account-deletion lands by mid-June without slipping
- Retention engineering is taken as seriously as feature engineering

**The product-bet odds favor "ship and validate," not "build more before launching."** Every week not in the App Store with paid sub flow is a week wasted in this category — the AI competitive landscape moves faster than your iteration cycle. Better to launch Plan 8 at week 7 and learn from real users than to build Plans 8 + 9 in parallel for 10 weeks before any external feedback.

**The Babbel Speak / Duolingo Max signals are sobering.** They confirm: AI conversation alone is NOT enough to command sub revenue. **Our entire pitch has to be the coaching system, not the AI.** Memory + feedback + vocab + pronunciation are the system. AI is the engine that makes them feel intelligent. Sell the system. Show the engine.

**The single biggest risk after burnout:** taking too long to launch and missing the differentiator window. ChatGPT memory rollout to voice, Babbel Speak gaining traction, Speak's continued OpenAI Realtime polish — the gap closes monthly. **Ship Plan 8 in July, not September.**

**The single biggest opportunity:** the coaching loop (memory + feedback + vocab + role-play) genuinely doesn't exist as an integrated product today. Speak has AI conversation. ELSA has pronunciation. Babbel has structured lessons + free AI. Duolingo has gamification. Nobody has all four wired into one coherent loop that compounds. If we ship that loop, the positioning writes itself.

---

## TL;DR

1. **Round 1's draft was too rosy on pricing, margin, and competitive landscape.** Round 2 corrects: $7.99/mo, real margin is 30–50% not 70%, Babbel Speak is now free, Duolingo Max at 9% means AI-voice-alone is commodity.
2. **Reposition: "coaching system that uses AI" — not "AI conversation app."** This survives Babbel-Speak-free. Pure-AI-conversation positioning does not.
3. **Pick a niche launch persona** — recommended: "AI conversation coach for engineers/remote workers learning Italian/Spanish/French/German for relocation." Everything else stays generic, the launch story is narrow.
4. **Plan 8 = 4–5 weeks honest** (memory + end-of-session feedback + role-play + paywall + push + freemium quotas). Account-deletion is a HARD BLOCKER — spec Plan 8 in parallel but don't start implementation until deletion merges.
5. **Plan 9 = 4 weeks** (vocab extraction + card game + SRS + confidence chart + streak insurance). `vocab_items` table already exists — head start.
6. **Plan 10 = 3 weeks** (pronunciation via Azure + user-audio storage + daily auto-lesson + gentle correction).
7. **Distribution: commit to YouTube weekly + Reddit adjacent.** 8–12h/week content. Real number, not optional.
8. **Pricing: $7.99/mo + $49.99/yr + 7-day trial. No lifetime in v1.**
9. **Free tier: 10 min/day, last 3 sessions, 3 role-plays, basic memory, current-session feedback. Card game 10/day.**
10. **Outcome probabilities (18 months):** $1k MRR ~40–50%, $10k MRR ~10–15%, $50k MRR <5%. If $1k–10k MRR is a meaningful outcome for you, proceed. If not, niche tighter or reconsider.
11. **The 12 open decisions** above are what to resolve when we brainstorm next. Top three: niche persona, pricing, YouTube vs other channel.

---

_End of Round 2. The 12 open decisions are the brainstorm input for the next session._
