# Monetization & Ad Revenue — covering free-user costs, ads, and revenue projections

**Date:** 2026-06-04
**Author:** Claude (at Bruno's request)
**Companion to:** `2026-05-30-strategy-round-2.md` (canonical strategy). This doc does **not** replace it — the strategy doc owns pricing, positioning, and the subscription funnel. This doc adds the layer the strategy doc never covered: **how to stop free users from costing money, whether ads can help, and what the combined revenue actually looks like.**

> ⚠️ All figures are **estimates with explicit assumptions**, not guarantees. Ad eCPM in particular is highly variable (geo, engagement, season). Treat the projections as a model to reason with, not a forecast.

---

## 0. Numbers carried over from the strategy doc (so we stay consistent)

| Lever               | Canonical value (strategy doc)                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Price               | **$7.99/mo, $49.99/yr ($4.16/mo eq.), 7-day opt-out trial**                                                                  |
| Net after store cut | 30% → **$5.59/mo** net (monthly), **$34.99/yr** ≈ $2.92/mo (annual)                                                          |
| Free tier           | **5 min/day voice** (10 min "honeymoon" for the first 3 days — see §8), 3 role-plays/day, last 3 sessions, basic memory free |
| Cost to serve       | **~$0.025/min API only**; **$0.05–0.10/min user-facing** (infra + margin)                                                    |
| Conversion          | trial→paid **38–54%**; download→subscriber **1.7%**; download→trial **3.7–8.9%**                                             |
| Target              | **$1k MRR (40–50% likely)** — NOT a $10k+ optimized play                                                                     |
| Heavy-user margin   | At 60 min/mo a Pro user nets only **$0–2/mo** contribution; light users $3–5                                                 |

The ad layer below is built **on top of** these, not against them.

---

## 1. The core thesis (the honest reframe)

**Ads alone will (almost) never cover an AI voice app.**

The problem: your **cost per free user is abnormally high** for a mobile app. Most free apps cost ~$0/user (just hosting). Here, **every minute of conversation costs real money**: STT + LLM + TTS.

Order of magnitude (all-in, to _serve_ — API + infra, no margin): **~$0.03–0.05/min.**

A free user's monthly cost:

- 5 min/day → ~$0.20/day → **~$6/mo**
- 10 min/day (the current cap) → **~$9–15/mo**

👉 An _engaged_ free user can cost you **more than a subscriber earns you**. That is the AI-app trap.

What a mobile ad earns:

- **Rewarded video** (the most lucrative): eCPM ~$10–30 in rich geos (US/UK), ~$1–5 elsewhere. So **one ad watched ≈ $0.005–0.03.**
- Banner / interstitial: less.

So: **a minute of voice costs ~$0.05; an ad watched earns ~$0.01.** One ad doesn't even pay for one minute. Ads **cannot** fund unlimited AI voice. That's arithmetic, not pessimism.

---

## 2. The real lever #1: cap the cost (you already have half of it)

Before ads, what actually stops free users from bleeding you:

1. **Hard usage caps** — you ALREADY have this (`FREE_TIER_VOICE_SECONDS_PER_DAY/MONTH`). The value of this number IS your cost dial. A free tier at 3–5 min/day bounds cost to ~$2–4/mo max per user. The strategy doc's 10 min/day matches Talkpal and helps conversion, but from a pure cost view it allows a maxed-out free user to cost ~$9–15/mo. **This tension is the single most important monetization decision.** (See §6.)
2. **Cheaper models for free tier** — cheap STT/LLM/TTS for free, premium for Pro (already tracked in the model-benchmarking work).
3. **Caching** — greetings already cached; extend to recurring phrases / openers.

**Takeaway: the cap is the dominant cost lever. Ads are secondary.**

---

## 3. Where ads DO make sense: rewarded video

Not to "cover costs" globally, but to **align cost and revenue minute-by-minute**:

> "Your free session is over. **Watch an ad to earn +3 minutes.**"

This is the smart pattern: the user who wants more pays in attention (an ad) at the exact moment they generate cost. It turns a sunk cost into a **partially-offset** cost, and it **pushes toward subscription** (after 3–4 ads → "subscribe to remove ads & limits"). It's a **conversion lever**, not a primary revenue source.

### Ads basics (since you're starting from zero)

- **Ad network:** **Google AdMob** (the mobile standard). For Expo/RN → `react-native-google-mobile-ads` (Expo plugin). Native module → reminder: run `pnpm install` after `expo install` or the binary won't ship in the build.
- **Formats:** _rewarded_ (your target), interstitial (between screens), banner (low revenue, hurts UX). **For you: rewarded only at first.**
- **Consent is mandatory:** GDPR (EU) via AdMob's UMP SDK, and **ATT on iOS** (the "Allow tracking" prompt). Without these → account bans / near-zero revenue. Apple/Google enforce strictly.
- **eCPM depends on country:** a French/US user earns 5–10× more than a user in a low-income country. Your worldwide audience drags the average down.

---

## 4. Revenue projections (subscriptions = backbone, ads = supplement)

**Assumptions** (anchored to strategy doc; conservative):

- Blended net ARPU per paid sub: **~$4.50/mo** (mix of monthly $5.59 net and annual $2.92 net equiv.).
- Steady-state **paid ≈ 2.5% of MAU** (between the 1.7% download→subscriber and higher active conversion).
- Blended **free-user cost to serve: ~$0.50/free MAU/mo** (most are light; a minority approach the cap — this is the most uncertain input and is highly cap-dependent).
- **Ad ARPU: $0.05–0.10 per free MAU/mo** (rewarded-led, non-game, worldwide blend — deliberately conservative).

|                              | Early              | Base (≈ $1k MRR target) | Stretch                |
| ---------------------------- | ------------------ | ----------------------- | ---------------------- |
| MAU                          | 2,000              | 8,000                   | 20,000                 |
| Paid subs (~2.5%)            | 50                 | 200                     | 500                    |
| **Subscription MRR (net)**   | **~$225**          | **~$900**               | **~$2,250**            |
| Free MAU                     | 1,950              | 7,800                   | 19,500                 |
| **Ad revenue**               | $100–195           | $390–780                | $975–1,950             |
| Free-user cost to serve      | ~$975              | ~$3,900                 | ~$9,750                |
| Pro infra/variable cost      | ~$150              | ~$600                   | ~$1,500                |
| **Net (subs + ads − costs)** | **−$650 to −$800** | **−$2,200 to −$2,600**  | **−$6,300 to −$7,300** |

### Read this carefully

With a **10 min/day free cap and only ~2.5% conversion, the math is underwater** — free-user cost dwarfs both subscription and ad revenue. This is the real danger Bruno sensed. Two things fix it:

1. **Tighten the cap and/or gate extensions behind rewarded ads** (see §6) → cuts the dominant cost line.
2. **Improve conversion** (better onboarding, trial start rate) → more subs per free user.

The same Base scenario with a **tighter free cap (≈ $0.15/free MAU cost)** and **3% conversion**:

|                   | Base (tuned)                                                                  |
| ----------------- | ----------------------------------------------------------------------------- |
| MAU               | 8,000                                                                         |
| Paid subs (3%)    | 240 → **~$1,080 MRR**                                                         |
| Free-user cost    | ~$1,170                                                                       |
| Ad revenue        | ~$585                                                                         |
| Pro variable cost | ~$700                                                                         |
| **Net**           | **≈ −$200** (roughly break-even, trending positive as annual subs accumulate) |

👉 **Ads don't make free users profitable. The cap + conversion do. Ads turn "deeply negative" into "near break-even" on the free base, and accelerate upgrades.**

---

## 5. Does it cover the costs? Honest verdict

**No — not ads alone.** The model that works for you is a **tripod**:

1. **Tight caps** → bound free-user cost (the #1 lever).
2. **Rewarded ads** → _partially_ offset free cost + push to subscription.
3. **Subscriptions (RevenueCat — already wired)** → **this is what actually funds everything.**

Ads are the **cherry**: a little revenue on free users + a conversion trigger. The **cake is the subscription.** For an AI voice app, betting on ads as primary revenue is a losing game.

---

## 6. Recommendation (staged, side-hustle realistic for ~$1k MRR)

1. **First, set the cap dial.** Resolve the tension: a generous 10 min/day is great for engagement but cost-dangerous. Recommended: **lower the always-free baseline (e.g. 5 min/day)**, then let **rewarded ads top it up** (+3 min/ad, cap 2–3 ads/day). This bounds baseline cost AND ties every extra minute to an ad view. Free to implement (cap value); medium for the ad wiring.
2. **Then add rewarded ads** as the "+minutes" mechanic — creates a 2nd revenue stream **and** a conversion funnel ("subscribe to remove ads & limits"). This pairs naturally with the Plan 8 paywall + quota work.
3. **Never treat ads as primary revenue.** Subscriptions carry the business; ads soften the free-tier bleed.
4. **Watch unit economics per cohort** — add the "cost per free MAU" and "ad ARPU per free MAU" to the cost dashboard so the cap can be tuned with real data, not guesses.

### Sequencing vs. the roadmap

The paywall + entitlements + daily-quota work is already a **Plan 8** task (strategy doc §"Plan 8"). Rewarded ads are a natural **Plan 8 add-on or fast-follow**: the quota-exceeded moment is exactly where both the paywall AND the "watch an ad for +minutes" prompt fire. Build them together.

---

## 7. Decisions (resolved 2026-06-04 with Bruno)

1. **Free baseline: 5 min/day + ad top-ups.** ✅ DECIDED. The always-free baseline drops from the strategy doc's 10 min/day to **5 min/day**; extra minutes come only from rewarded ads (and removing limits is a subscription upsell). ⚠️ The strategy doc still says 10 min/day — update it for consistency when next revising it.
2. **Ads only as the quota-extension mechanic.** ✅ DECIDED. No ads shown to paying or trialing users; never ad-spam the core loop. The rewarded ad fires only at the "free quota reached → +3 min for an ad" moment.
3. **Ads on BOTH iOS and Android, with auto non-personalized fallback.** ✅ DECIDED. Integrate AdMob once for both platforms, show the iOS ATT consent prompt, and let AdMob serve non-personalized ads to users who opt out. Rewarded video is the format least hurt by ATT opt-out, so no need to skip iOS. (Reminder: GDPR UMP consent in the EU is handled the same way.)
4. **Ads everywhere (all geos).** ✅ DECIDED. In this design the rewarded ad's primary job is **cost-control + conversion nudge**, not revenue — so it earns its place even in low-eCPM geos (it still bounds free cost and pushes toward subscribing). Ad revenue is just a bonus where eCPM is high.

---

## 8. Free-cap refinement — "honeymoon → squeeze" (shipped 2026-06-26)

The §7 decision ("5 min/day baseline") is now **implemented**, refined with one addition: a **honeymoon window**.

### The decision

- **Days 1–3 (rolling, from signup): 10 min/day.** Enough to reach the "aha" and build a daily habit.
- **Day 4+: 5 min/day baseline.** The wall now bites every day for the engaged learner.
- **Rewarded ad: +3 min, 1×/day, only at the wall**, kept as the **secondary** choice next to the Pro trial.

### Why a honeymoon (the science, not just cost)

The real problem with a generous cap isn't the cost — it's **conversion pressure**. At 10–13 min/day forever, your most motivated learner (your best prospect) is _satisfied_ and never feels a reason to pay. The honeymoon resolves the tension between two needs:

- **Build the habit + endowment first** (generous days 1–3) → the user invests, forms a routine, and starts to "own" the product (endowment effect).
- **Then create a felt gap** (drop to 5 min) → **loss aversion** does the work: they had 10, now they feel the squeeze, and the upgrade is the obvious way to get it back. The cut-off lands mid-conversation (peak engagement), which is the strongest conversion moment.

Benchmarks (2026) backing the structure: freemium→paid is **3–5%**, but an **opt-out free trial converts at 25–60%** — so the wall must push the **7-day trial** as the primary CTA, with the ad as the escape hatch. 82% of trials start on day 0, so the honeymoon also front-loads the trial offer. Talkpal's free tier is 10 min/day, so the honeymoon stays competitive on first impression while the steady-state 5 min protects margin.

### Cost reality (refreshed against the live rate cards)

Per minute of conversation (only ~30 s STT + ~30 s TTS are billed per wall-clock minute):

| Stack                                | $/min           | Driver    |
| ------------------------------------ | --------------- | --------- |
| Default (gpt-4o-mini-tts + Deepgram) | **~$0.01**      | TTS ≈ 90% |
| Premium (ElevenLabs)                 | **~$0.05–0.10** | TTS       |

Planning figure **~$0.02/min**. Daily caps at full use: **5 min ≈ $3/mo**, 10 min ≈ $6/mo, 13 min ≈ $7.80/mo (real average is lower — usage rarely maxes the cap — but it concentrates on heavy users, who are also the best Pro prospects).

**The ad still doesn't pay for itself:** one rewarded view earns ~$0.005–0.02; the +3 min it grants costs ~$0.06 → it recovers only **~15–30%** of the minutes it unlocks. Confirmed: ads are a nudge/soft-offset, not revenue. Do **not** widen them.

**Pro margin is thin too:** $7.99 → ~$5.59 net (30% cut). A Pro user at the full 60 min/day would cost far more than they pay — so the **60 min/day Pro cap is margin protection, not a generosity limit**, and cheap default TTS is mandatory.

### Implementation (where it lives)

- `apps/api/src/env.ts` — `FREE_TIER_VOICE_SECONDS_PER_DAY` 600→**300**; new `FREE_TIER_VOICE_SECONDS_PER_DAY_HONEYMOON=600`, `FREE_HONEYMOON_DAYS=3`. (Monthly `canUseSeconds` is legacy/unenforced — daily cap is authoritative.)
- `apps/api/src/lib/quota.ts` — `dailyCapSeconds()` now reads the account's `accountCreatedAt` and returns the honeymoon cap inside the window, baseline after. Missing date → baseline (safe default).
- `apps/api/src/routes/voice.ts` — threads `profile.createdAt` into the cap calc at all gates (session start, turns, ad-extension).
- `apps/mobile/app/(modals)/daily-limit.tsx` — wall now leads with the **trial** ("Try Pro free — 60 min/day") + loss-framed value line; ad stays secondary.
- `apps/mobile/app/(modals)/paywall.tsx` — CTAs lead with "Start free trial"; stale "vs 10 min" fixed to "vs 5 min".

### Next (not in this change)

Add `cost per free MAU` + `trial-start rate at the wall` to the admin dashboard, then A/B the honeymoon vs flat 5 min once volume allows (skills: `analytics`, `ab-testing`).

---

_Generated at Bruno's request as a companion to the Round 2 strategy doc. Update if pricing, the free cap, or the provider cost model changes._
