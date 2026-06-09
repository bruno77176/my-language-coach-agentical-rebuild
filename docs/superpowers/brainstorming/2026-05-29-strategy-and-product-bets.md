# Language Coach — Strategy & Product Bets (deep dive for Bruno)

_Written 2026-05-29 as an async deep-think. Bruno will read tomorrow, then we brainstorm together._

This document covers:

1. **Honest market reality** — what category we're in, who else is in it, what the ceiling actually looks like
2. **The economics** — provider costs, pricing, conversion math, when this breaks even
3. **The 4 ideas you raised, scored** — memory, end-of-session feedback, vocab card game, role-play
4. **Additional bets I think we should consider** — and which I'd skip
5. **Suggested launch sequence** — what Plan 8 / 9 / 10 should actually contain
6. **Risks and what to watch** — including the ones that quietly kill indie launches
7. **Open questions for tomorrow** — the things only you can decide

The TL;DR is at the bottom so you read the reasoning first.

---

## 1. Honest market reality

### The category

You're not building a "language learning app" — that market is owned and is also enormous (~$60B+ globally, 1.5B+ learners). You're building an **AI conversation coach**. That's a subcategory that didn't exist in shippable quality 2 years ago and is now extremely hot.

### Who is actually in this lane

Treat these as the competitive set, not Duolingo/Babbel/Rosetta. Those are different products even if they overlap on the App Store.

| Competitor        | Funding / status                | Product center                    | What they're good at                        |
| ----------------- | ------------------------------- | --------------------------------- | ------------------------------------------- |
| **Speak**         | Series C, big revenue           | AI tutor + structured lessons     | Best polish, biggest marketing, K-content   |
| **Talkpal**       | Growth-stage                    | AI conversation across 50+ langs  | Rapid iteration, low pricing                |
| **Praktika**      | Series A                        | 3D avatar-based AI tutor          | Avatar UX, immersive feel                   |
| **Loora**         | Seed/Series A                   | Business English AI               | B2B story, premium positioning              |
| **ELSA Speak**    | Series C                        | Pronunciation scoring             | Phoneme-level moat, real differentiator     |
| **Univerbal**     | Indie                           | Conversation drills               | Speedy ship cycle                           |
| **Lingvist**      | Established                     | Adaptive flashcards               | Big SRS catalog                             |
| **Memrise**       | Established                     | Native-speaker video + flashcards | Brand                                       |
| **Babbel Live**   | Established + tutor marketplace | Live human tutors                 | Trust                                       |
| **ChatGPT Voice** | Free with Plus                  | General-purpose voice             | The elephant — your users already have this |

**Critical point:** ChatGPT Voice is the real competitor. It's free with a Plus sub, supports 60+ languages, voice is excellent, and millions of people already use it for language practice. Your product has to be _meaningfully better than ChatGPT Voice at the specific task of helping someone improve a language_, otherwise the answer to "why pay you $10/mo?" is "I won't, I have ChatGPT."

That's the bar. It's high. But it's also achievable, because ChatGPT Voice is good at conversation and bad at coaching:

- No memory (each session starts cold)
- No structured feedback after a session
- No vocab tracking, no SRS
- No streak / no habit loop
- No role-play scaffolding
- No progress sense (am I getting better? at what?)

Every one of those gaps is where you live.

### What can a solo indie win on

Indie devs do not out-market or out-fund this category. Indie devs win by:

1. **Niche/positioning.** "AI language coach" is generic — nobody downloads that. "Become conversational in Italian for your Italian in-laws" or "AI coach for engineers moving to Berlin" is specific — that person clicks. You don't have to permanently restrict the app, but the **launch story** must be narrow. Pick one persona for the first 6 months.
2. **Pedagogy.** Conversation + memory + targeted feedback that compounds — done well, this beats generic AI chat by a wide margin. Most competitors do one of these well, none integrate all of them.
3. **Cost discipline.** Speak burns ~$300+ per paid acquisition. You can't. So you need community-led growth (Reddit, TikTok founder vlog, App Store SEO, referral) — which means launch quality has to be a real story, not just functional.
4. **Speed.** Solo dev with no committee = ship in days what funded competitors ship in months. Use this.

### Honest opinion on potential

**Yes, there is real potential.** Caveats:

- The realistic _modest success_ shape is **5k–20k paid users, $50k–$300k ARR over 18–24 months**. Not unicorn. Real money, real validation, replaces a salary or builds a runway.
- The realistic _failure_ shape (more probable than success) is **<500 paid users, <$5k/mo, slow churn down to nothing**. Most indie launches in any category end here. The reason is almost always distribution, not product.
- The wildcard _breakout_ shape (low probability, possible) requires a viral moment — a TikTok creator picks it up, a Reddit thread blows up, an HN front page hits. You can't plan for this but you can be ready for it (App Store metadata, paywall, infra that scales).
- Building this even if it doesn't reach $1M+ ARR is **still worth it** if: (a) it ships, (b) you ship it for a price you can absorb, and (c) it teaches you the craft of consumer apps. You will get good at things that compound.

The thing I'd push back on: "I want thousands of downloads and a decent proportion to pay." Thousands is easy with ASO + good launch. The hard part is **a decent proportion paying**. That requires the product to be _addictive_ in the first 7 days, not _just good_.

---

## 2. The economics — can this actually work

### Variable cost per minute of conversation (current stack)

Using the rates in your `model-benchmarking` notes:

| Provider                            | Rate                                             | Per minute (est.) |
| ----------------------------------- | ------------------------------------------------ | ----------------- |
| Deepgram Nova-3 STT                 | ~$0.0043/min audio                               | $0.0043           |
| GPT-4o-mini chat                    | $0.15/M in + $0.60/M out, ~1500 tokens/min mixed | ~$0.0040          |
| OpenAI gpt-4o-mini TTS              | ~$0.015/min audio                                | $0.0150           |
| Supabase Storage egress + DB writes | small                                            | ~$0.0010          |
| **Total**                           |                                                  | **~$0.025/min**   |

This is **conversation talk time**, not session time including pauses.

### Free vs Pro usage profiles (estimates)

| Tier          | Talk/week | Talk/month | Variable cost/month |
| ------------- | --------- | ---------- | ------------------- |
| Free (active) | 5–10 min  | 20–40 min  | $0.50–$1.00         |
| Free (heavy)  | 20 min    | 80 min     | $2.00               |
| Pro (typical) | 30 min    | 120 min    | $3.00               |
| Pro (heavy)   | 60 min    | 240 min    | $6.00               |
| Pro (whale)   | 120 min   | 480 min    | $12.00              |

### Pricing benchmarks (approximate, 2026)

| Competitor     | Monthly | Annual              | Notes                              |
| -------------- | ------- | ------------------- | ---------------------------------- |
| Duolingo Super | ~$13.99 | ~$84 ($7/mo equiv.) | Huge anchor — but different cat.   |
| Babbel         | ~$14    | ~$84                |                                    |
| Speak          | ~$14.99 | ~$99                | Closest comp                       |
| Talkpal        | ~$9.99  | ~$60                | Aggressive                         |
| ELSA Premium   | ~$11.99 | ~$60                |                                    |
| ChatGPT Plus   | $20     | n/a                 | Anchor for "AI voice" expectations |

### Recommended pricing for v1

- **Monthly:** $9.99/mo
- **Annual:** $59.99/yr ($5/mo equivalent — 50% off, drives conversion)
- **First-month promo:** 50% off first month or 7-day free trial
- **Lifetime "founders" deal:** $99 lifetime, limited to first 200 buyers — surfaces motivated early adopters, gives you cash NOW

Why $9.99: undercuts Speak/Babbel by ~30%, matches Talkpal (which is the price-competitor), still feels "real" (sub-$5 signals toy).

### Margin reality at $9.99/mo

|                             | Gross | After 30% store cut | After 15% (yr 2+) |
| --------------------------- | ----- | ------------------- | ----------------- |
| Revenue                     | $9.99 | $6.99               | $8.49             |
| Variable cost (typical Pro) | $3    | $3                  | $3                |
| **Contribution margin**     | $6.99 | $3.99               | $5.49             |
| **Margin %**                | 70%   | 57%                 | 65%               |

For heavy/whale Pro users the margin collapses. Mitigation:

- **Soft quota even on Pro:** 60 min/day cap, with a "you've talked a lot today, want a break?" gentle warning. Caps abuse from someone running the mic 24/7.
- **Pro tier uses premium TTS** (Inworld 1.5 Max or Gemini 3.1 Flash TTS — both better and same/cheaper $/min than current OpenAI). This actually _improves_ margin while improving quality.
- **Cap memory/feedback LLM calls** to one per session.

### Break-even math

Fixed costs estimate at launch:

| Item                   | Cost/mo        |
| ---------------------- | -------------- |
| Fly.io (shared CPU)    | $5             |
| Supabase Pro           | $25            |
| Sentry / EAS           | $0–25          |
| RevenueCat (1% of rev) | ~$0            |
| Domain + email         | $2             |
| **Total**              | **~$35–60/mo** |

**At 0 paid users + 100 free users:** ~$60/mo costs, $0 revenue = **-$60/mo**
**At 50 paid users:** $35 fixed + 50×$3 variable ≈ $185/mo cost, 50×$7 ≈ $350/mo rev = **+$165/mo**
**At 200 paid users:** ~$700/mo cost, $1400/mo rev = **+$700/mo**
**At 1000 paid users:** ~$3.5k/mo cost, $7k/mo rev = **+$3.5k/mo**

**Break-even is ~30 paying subscribers.** That is _very_ achievable if the product is good. The question isn't "can we afford this" — it's "can we get to 30 paying subs in the first 90 days." If yes, it self-sustains. If no, we keep trying because hosting cost is sub-$100/mo.

### Conversion benchmarks

| Segment                           | Free→Paid conversion |
| --------------------------------- | -------------------- |
| Casual mobile apps (broad)        | 1–3%                 |
| Duolingo Super                    | ~5–7%                |
| Speak (best in class AI category) | est. 5–8%            |
| Indie AI app (cold start)         | est. 1–3%            |

**Plan for 2% free→paid conversion** in the first 6 months. At 2%, 1500 free users = 30 paid = break-even. So the goal becomes: **get to 1500 active free users**. That's the real product-marketing target.

---

## 3. The 4 ideas you raised, scored

I'm ranking by **(impact on retention/conversion) × (cost to ship) × (defensibility vs competitors)**.

### A. Coach memory across sessions — SHIP THIS FIRST

**Why it matters:** You named this yourself. The "always starts cold" feeling is the #1 reason free conversation gets boring. Fixing it makes the coach feel _intelligent_ in a way ChatGPT Voice cannot, because ChatGPT Voice doesn't persist anything per-language between Plus sessions.

**Cost:** Already designed in your `coach_memory_feature.md` memory. ~1–2 weeks, structured-profile approach with `coach_memory` table, per-language scope, `gpt-4o-mini` extraction at session end.

**Free vs Pro:**

- **Free** gets _basic_ memory: name, level, recent topics list (last 5), one-line summary of last session. This is critical for the free experience to not feel cold — don't gate this away or the free tier won't convert because free will feel terrible.
- **Pro** gets _deep_ memory: weak areas, personal context (hobbies, family, job), long-running themes the coach picks up on, "last time we were talking about X — want to continue?" hook.

**Privacy:** Profile screen → "Coach Memory" section → user sees and can edit/delete what's stored. Required for trust + GDPR.

**Risk:** Hallucinated facts ("you said you worked at Google" when you said no such thing). Mitigation = let users see and correct.

### B. End-of-session feedback / analysis — SHIP THIS WITH MEMORY

**Why it matters:** This is the actual "coach" payoff. Without it, you're just an AI chat. With it, every session produces a tangible artifact ("here's what you learned today, here's what to work on"), which is the kind of thing screenshot-worthy users share organically.

**Structure (3 panels):**

1. **What you said well** — 1–3 expressions/structures you used correctly. Reinforcement matters.
2. **What to improve** — 1–3 specific corrections, ideally tied to a grammar concept. "You said _'I go to the store yesterday'_ — past tense is _'I went'_. This is your most common slip — past simple of irregular verbs."
3. **Words & expressions to remember** — 3–8 vocab items: words you used that you should solidify + words the coach used you might not know yet. Saved to your vocab list (which feeds the card game in Plan 9).

**Cost:** 1–2 weeks. One `gpt-4o` (NOT `gpt-4o-mini` — quality matters here, ~$0.01/session is fine) call at end of session with the transcript + memory. JSON-structured output with Zod validation.

**Free vs Pro:**

- **Free** gets the feedback for the _current_ session, last 3 sessions in history. No audio playback of phrases.
- **Pro** gets full history, audio playback of any phrase ("hear how the coach said this correction"), and a weekly "your progress this week" digest email.

**Risk:** GPT-4o sometimes invents grammar rules that are wrong. Mitigation: prompt explicitly instructs "if uncertain, omit rather than fabricate" + we ship a "this correction seems wrong" flag button for users to report (and over time, we improve the prompt).

### C. Vocab card game from conversation — SHIP IN PLAN 9, NOT 8

**Why it matters:** This is your most defensible long-term feature because the vocab comes from _your_ conversations, not a generic deck. Combined with spaced repetition it becomes the addictive habit Duolingo has spent a decade engineering. The screenshots you shared are excellent reference — clean dark, card-stack metaphor, voice answer, combo meter, energy/lives. That game design works; we should copy that pattern.

**Why not Plan 8:** It's the most expensive feature in time and risk. We should ship memory + feedback + role-play (~4 weeks) and validate retention BEFORE investing 3–4 more weeks in the card game. If memory + feedback alone gives us 30+ paid users in 90 days, the card game becomes the conversion-doubler. If memory + feedback gives us 0 paid users, the card game probably won't save it and we have a positioning problem to solve first.

**v1 design (Plan 9):**

- **Vocab extraction**: at end of each session, `gpt-4o-mini` extracts ~5–8 items: target-lang term, native-lang translation, the exact sentence from your conversation where it appeared, difficulty (A1–C2), part of speech.
- **Card modes** (from your screenshots, in priority order):
  1. **Voice translate** (your screenshot 1, 3, 4) — see word, say translation, STT scores
  2. **Tap translate** (your screenshot 2 with the multiple-choice green options) — fastest, lowest friction, great for re-encounter
  3. **Type translate** — for serious users
  4. **Listen + repeat** — pronunciation focused
- **SRS engine**: Anki-style intervals (1d / 3d / 7d / 14d / 30d / 90d), with adjustment on success/fail. Implementation is well-documented; use FSRS algorithm if we want best-in-class. ~3 days of work.
- **Game shell**: combo meter, lives ("energy"), daily goal of 10 cards, streak. Copy your screenshots' visual design closely (it's beautiful).
- **The dark mode in your screenshots is gorgeous** but our app's Sunrise palette is daylight-only. Decision needed: do we ship a separate "Game mode" with its own dark theme, or adapt the design to Sunrise? My vote: ship a dedicated dark theme for the game screen specifically — it makes the focus-mode story stronger.

**Free vs Pro:**

- **Free**: 10 cards/day, voice + tap modes, single review schedule.
- **Pro**: unlimited cards, all 4 modes, multi-deck (split by topic), audio playback of native pronunciation, "hardest words" filter.

### D. Role-play conversations — SHIP THIS IN PLAN 8 (cheapest big win)

**Why it matters:** Solves "what do I talk about today?" — the second-biggest reason people stop using AI coaches after "boring greeting." Plus it's _exactly_ the kind of feature people brag about ("I practiced ordering coffee in Italian!"). Strong screenshot/share moment.

**Cost:** This is the cheapest ambitious feature on the list. 3–5 days. It's a topic picker + a prompt template per scenario + a small "scene-set" intro from the coach.

**Scenario catalog (ship 10 for v1):**

1. Ordering coffee / food at a restaurant
2. Checking into a hotel
3. Asking for directions
4. Doctor visit (symptoms, medications)
5. Job interview
6. Small talk on a date / at a party
7. Customer service complaint
8. Phone call with a friend
9. Workplace meeting introduction
10. Emergency (police, lost passport)

Each scenario = ~30 lines of system prompt describing the role the coach plays, the scene, the expected language register, and 2-3 "twists" the coach should introduce ("your card is declined", "the waiter doesn't speak English", "your interviewer asks about a 6-month gap"). The twists are what make it _practice_ instead of _scripted dialogue_.

**Free vs Pro:**

- **Free**: 3 scenarios always available (coffee, directions, small talk).
- **Pro**: full catalog + we add ~5 new scenarios per month + user-suggested scenarios.

---

## 4. Additional bets worth considering

Ranked.

### E. Daily auto-generated mini-lesson (HIGH impact, MEDIUM cost) — Plan 10 candidate

"Today let's practice past tense — based on your last 3 conversations you've struggled with irregular verb forms." App opens straight into a 5-minute focused conversation around that weak area.

This is the single most personalized thing we can ship. It compounds with memory + feedback. It's a strong push-notification reason ("Bruno, ready for today's 5-minute lesson?"). It's a screenshot-worthy moment.

Cost: ~1 week. The hardest part is the prompt to choose a weak area and frame an exercise.

### F. Pronunciation feedback (HIGH impact, HIGH cost) — Plan 10 or 11

ELSA's entire $50M+ moat is phoneme-level pronunciation scoring. Building this from scratch is hard. Options:

1. **Use a specialized API** — Azure Pronunciation Assessment, SpeechSuper, or Speechmatics. These give per-phoneme + per-word scores. Cost ~$0.01–0.03/utterance. Easiest path.
2. **Build with Whisper + log-likelihood scoring** — cheaper but rough quality.
3. **Use OpenAI Realtime API in "evaluator" mode** — newer, untested for this.

**Recommendation:** Plan 10 or 11. Use a paid API. Pro-tier only. Position as "your pronunciation report card."

This is also a candidate for the storing-user-audio feature you flagged in `plan_8_ideas` — store the user's audio (with consent) so they can replay their own attempts and see improvement over weeks.

### G. Speaking confidence chart over time (MEDIUM impact, LOW cost) — Plan 9 or 10

A weekly chart: words-per-minute, hesitation rate, vocabulary diversity score. Indie-app bait — extremely screenshot-worthy ("I went from 60 wpm to 95 wpm in 4 weeks"). Implementation: metrics already captured in transcripts + a small dashboard widget.

### H. Streak insurance / "freeze" (MEDIUM impact, LOW cost) — Plan 8 or 9

Duolingo's trick. One streak freeze per week. Reduces "I broke my streak, why bother" churn. Free benefit OR limited free (1/month) + unlimited Pro.

### I. Conversation continuation across days (HIGH impact, LOW cost — falls out of memory) — Plan 8

When user opens app: "Last time we were talking about your trip to Mexico City — want to keep going, or start something new?" Two-button choice. This is one prompt change + a UI button. The reward is enormous: it's the strongest single signal that the coach remembers you. Don't skip this.

### J. Real-time gentle correction (HIGH impact, MEDIUM cost) — Plan 9

Coach occasionally interjects with a small fix: "small fix — 'I went' not 'I go'. Anyway, please continue." Configurable: off / occasional / strict. Crucial that it's tasteful and infrequent (max 1 per 5 turns) or it kills flow. Risk: kills flow if done badly. Toggle in settings makes it safe.

### K. Founder vlog / community presence (CRITICAL distribution) — Ongoing from Plan 8

Not a feature, a distribution decision. Pick one channel and commit:

- **TikTok/Reels**: solo dev building in public. 60-second vids. "I built an AI to help me learn Italian — here's what happened in week 1." High effort, occasionally viral.
- **Reddit**: r/languagelearning (2.7M), r/Italian/r/French/etc. Posts about the tech and learnings, never "use my app." Slow burn, very high trust.
- **Twitter/Bluesky**: dev-twitter for technical posts (Supabase + Expo + AI stack story is sharable to other indie devs).
- **YouTube**: harder but highest LTV — language-learning advice + product walkthroughs.

Pick one, post weekly for 6 months, then evaluate. Distribution is not optional.

### L. Things I'd NOT build for v1 (resist these)

- **Multiplayer / leaderboard with friends** — high social-engineering complexity, low impact pre-1k users
- **Marketplace of human tutors** — iTalki's moat, you can't compete
- **Skill tree / Duolingo-style structured course** — Babbel's moat, 1000s of hours of content, you can't compete
- **Native mobile games beyond the card game** — feature creep
- **Native iPad / Apple Watch / wearables apps** — distraction
- **B2B/enterprise sales** — wrong audience entirely
- **AI image generation for "visual vocab"** — fun demo, low retention impact

---

## 5. Suggested launch sequence

The current Plan 8 in your notes bundles _topics + vocab + freemium + push + paywall_. That's too much for one plan. Split it:

### Plan 8 — "The Coaching Loop" (3–4 weeks, the v1 launch)

Goal: **launch a paying-allowed app to the public.** Three features that compound into a story.

**Features:**

1. **Memory** (per-language, structured profile, basic free + deeper Pro) — A above
2. **End-of-session feedback** (3 panels: highlights, corrections, vocab) — B above
3. **Role-play picker** (10 scenarios, 3 free / 7 Pro) — D above
4. **Conversation continuation** ("last time we were talking about X…") — I above, falls out of memory
5. **Push notifications** (streak reminder + "your coach is waiting" at user's preferred time)
6. **Paywall + RevenueCat + freemium quotas** (10 min/day free, soft 60 min/day Pro)
7. **Privacy & consent**: memory consent screen in onboarding, "Your Coach's Memory" editor in Profile, GDPR delete (already in flight)
8. **Pricing UI**: $9.99/mo, $59.99/yr, 7-day trial, optional $99 lifetime founders for first 200

**Out of scope for Plan 8:** vocab card game, pronunciation feedback, real-time correction, daily auto-lesson, streak insurance.

**Definition of done:** Bruno can post in r/languagelearning "I built an AI conversation coach with memory and feedback — here's what I learned." Twenty paid subscribers in the first 30 days = launch validated.

### Plan 9 — "The Vocab Loop" (3–4 weeks)

Goal: **the addictive habit loop.** Card game makes Plan 8's feedback _actionable_.

**Features:**

1. **Vocab extraction** at session end
2. **Card game v1** (voice translate + tap translate modes, screenshots' visual design)
3. **SRS engine** (FSRS)
4. **Card audio** (native pronunciation playback)
5. **Game shell** (combo, energy, daily card goal, separate streak)
6. **Daily card review push notification**
7. **Speaking confidence chart** (G above) — small but impressive add
8. **Streak insurance** (H above)

**Definition of done:** Average session count per active user doubles from Plan 8 baseline.

### Plan 10 — "The Pronunciation Loop" (3–4 weeks)

Goal: **the strongest Pro-tier signature.** This is what gets free users to upgrade.

**Features:**

1. **Pronunciation scoring** (Azure Pronunciation Assessment or SpeechSuper, Pro-only)
2. **Audio storage with consent** (the feature you flagged in `plan_8_ideas`)
3. **"Listen to past you"** view — week-over-week pronunciation comparison
4. **Daily auto-generated mini-lesson** (E above)
5. **Real-time gentle correction toggle** (J above)
6. **Weekly progress email digest** (Pro)

**Definition of done:** Free→Pro conversion rate measurably improves.

### Phase 4 — Growth hacking (ongoing, starts during Plan 9)

- **ASO**: rank for "AI [language] tutor", "speak [language] AI", "[language] conversation"
- **Referral**: 1 month free for both parties
- **Share moments**: "share my weekly progress card" graphic
- **Founder vlog**: weekly TikTok/YouTube/Reddit posts about building & learning
- **Press**: HN, Product Hunt, Indie Hackers, language-learning newsletters
- **Affiliate**: 30% revenue share with language-learning content creators

---

## 6. Risks and what to watch for

### Risk 1: Apple/Google rejection at submission

Likely reasons:

- Subscription not properly described in App Store metadata
- AI content disclaimer missing
- Account-deletion flow incomplete (in flight on `account-deletion` branch — must land first)
- GDPR consent missing for memory feature

**Mitigation:** account deletion ships in Plan 8 (already nearly done), metadata reviewed against Apple's subscription guidelines, AI disclaimer in onboarding.

### Risk 2: Provider price changes / outages

OpenAI has changed prices 3 times in 2 years. Deepgram has had outages. ElevenLabs blocked PAYG voices.

**Mitigation:** provider abstractions already in place; the `model-benchmarking` memory tracks alternatives. We can swap STT/LLM/TTS in days, not weeks. Make sure each provider has a tested fallback.

### Risk 3: GPT-4o-mini gives wrong language teaching

Hallucinated grammar rules, wrong corrections, especially in less-common languages.

**Mitigation:**

- Use GPT-4o (not mini) for the feedback step where quality matters — cost is fine at ~$0.01/session
- Prompt explicitly says "if you're unsure, omit rather than guess"
- User-facing "this correction seems wrong" report button
- Internal weekly review of flagged corrections

### Risk 4: Privacy/GDPR with memory + audio storage

Storing personal facts + voice clips is legally non-trivial.

**Mitigation:**

- Explicit consent screens for both memory and audio storage
- User-visible, user-editable memory
- One-click "Delete my memory" / "Delete my recordings"
- Account deletion already in scope (Plan 8 prerequisite)
- Add data export (GDPR Article 20) — small, well-defined feature, do it once

### Risk 5: Bruno burnout

Solo founder, day job, ambitious roadmap. The #1 killer of indie SaaS isn't the market, it's the founder running out of energy in month 14.

**Mitigation:**

- **Each plan ships in 3–4 weeks max.** If a plan slips past 5 weeks, cut scope, don't extend.
- **Public commitment.** Tell your audience the plan ships by date X. External accountability is a real force.
- **Celebrate intermediate wins.** First paid user, first 5-star review, first viral post.
- **Take real breaks.** A weekend off after each plan ships. Non-negotiable.

### Risk 6: 7-day churn (the real silent killer)

Industry standard: 80%+ of new free signups never come back after day 1. Of those who do, most are gone by day 14.

**Mitigation:**

- **First-session experience is everything.** The first conversation MUST feel like the user got something out of it within 90 seconds. Memory hook ("hi, I'm your coach — what should I know about you?") sets up future sessions.
- **Day 1 push notification**: "your first feedback report is ready" (or similar — must be a real notification of value, not "come back").
- **Day 2 push**: "ready for your 5-minute warmup?"
- **Day 7 milestone**: "you've practiced 4 days — here's your first weekly summary" + soft Pro pitch
- **Day 14 retention check**: if user hasn't opened, send "we saved your progress, here's what's new this week" with a real new feature highlight

### Risk 7: ChatGPT Voice eats your lunch

Already addressed in Section 1, but to repeat: if your product is just "ChatGPT Voice with a better UI", you lose. Your differentiation has to be **the coaching layer** — memory + feedback + vocab + role-play as an integrated system that ChatGPT Voice fundamentally cannot replicate because it has no persistent per-language state per user and no end-of-session evaluator.

### Risk 8: User asks for niche language that's poorly supported

E.g., someone wants to learn Cantonese, but Deepgram + TTS don't support it well.

**Mitigation:** keep launch focused on the 12 supported languages already in shared config. Don't promise more until per-language testing is done. Add a "language wishlist" form on the landing page to gauge demand for additions.

### Risk 9: Pricing too low / too high

$9.99/mo might be too low (Speak charges $14.99 and people pay) — or might be needed to compete with Talkpal.

**Mitigation:** A/B test pricing _after_ Plan 9, not at launch. At launch, pick $9.99 and don't second-guess. Pricing power comes after 100+ paid users when we know who actually values what.

### Risk 10: Forgetting that account deletion is in flight

The current worktree is on `account-deletion`. This must land before App Store submission. Don't start Plan 8 implementation until it's merged.

---

## 7. Open questions for tomorrow's brainstorm

These are the calls only you can make. I have opinions but not the right to decide:

1. **Launch persona.** Who's the "Bruno test customer" for the first 6 months? My vote: someone like you — Italian-speaker learning English, or English-speaker learning Italian/French/German/Spanish. Niche enough to write convincing launch copy.

2. **Sunrise palette vs separate game theme.** The card game screenshots are dark mode and beautiful. Our app is Sunrise (daylight). Do we ship a dedicated dark theme for the game screen, or adapt the cards to Sunrise? My vote: dedicated dark for the game (it makes "focus mode" feel intentional).

3. **Pricing point.** $9.99/mo and $59.99/yr is my recommendation. Are you OK going lower to compete with Talkpal ($9.99/mo, $60/yr) or higher to position closer to Speak ($14.99/mo)?

4. **Lifetime "founders" deal.** $99 lifetime for first 200 buyers — yes or no? Pros: cash now, motivated early advocates. Cons: locks in a price floor, can't raise it for those users ever.

5. **Free tier daily quota.** I propose 10 min/day talk + 3 sessions of history + 3 roleplays. Aggressive? Too generous?

6. **Pro signature feature for v1.** What's the ONE thing on the Pro tier that's so good that someone screenshots it on Twitter? My vote: end-of-session feedback with audio playback of corrections. Yours?

7. **Distribution channel commitment.** TikTok, Reddit, Twitter/Bluesky, YouTube — which ONE do you commit to weekly for 6 months? Pick one, not all.

8. **Memory consent UX.** Mandatory consent in onboarding, OR opt-in via Pro? Mandatory is the better product (memory works for everyone). Opt-in is safer legally.

9. **AI provider for end-of-session feedback.** GPT-4o (better quality, ~$0.01/session) vs GPT-4o-mini (cheap, ~$0.0007/session, lower quality on language pedagogy). My vote: 4o for Pro, 4o-mini for free.

10. **Vocab card game theme art.** Direct copy of the screenshot style (clean dark + green/blue) or our own variant? The screenshots are clearly polished — would be wasteful to ignore.

11. **Account deletion: blocker yes/no for Plan 8 start?** Strictly speaking it must ship before App Store submission. Can you parallelize Plan 8 design while finishing account deletion? Probably yes.

12. **What if Plan 8 launches and gets 0 paid users in 30 days?** Don't panic-pivot. Plan 9 (card game) is likely the activation that pulls them over the line. Commit to running Plan 8 AND Plan 9 to see the full picture (~8 weeks).

---

## TL;DR (you can stop reading here)

**Is there potential?** Yes. Modest path to $50k–$300k ARR in 18–24 months is achievable. Unicorn path is not. Failure path is most probable but failure here is cheap.

**The competitor that matters most:** ChatGPT Voice. Your differentiation is the **coaching layer** (memory + feedback + vocab + role-play) that integrates as a system.

**The economics work** at $9.99/mo with ~70% gross margin pre-store-cut. Break-even is ~30 paying subscribers. Real comfort is at ~300 paying subscribers.

**Build sequence:**

- **Plan 8 (3–4w) — "The Coaching Loop":** memory + end-of-session feedback + role-play + paywall + push. Launch with this.
- **Plan 9 (3–4w) — "The Vocab Loop":** vocab extraction + card game (screenshots' design) + SRS + speaking confidence chart + streak insurance.
- **Plan 10 (3–4w) — "The Pronunciation Loop":** pronunciation scoring + audio storage with consent + daily auto-lesson + real-time correction toggle.

**The 4 ideas you raised:**

- Memory → ship in Plan 8 (already designed)
- End-of-session feedback → ship in Plan 8 (this is the differentiator)
- Vocab card game → ship in Plan 9 (highest cost, validate Plan 8 first)
- Role-play → ship in Plan 8 (cheapest big win)

**The features I'd add:**

- Conversation continuation across days (falls out of memory — must ship Plan 8)
- Daily auto-lesson based on weak areas (Plan 10)
- Speaking confidence chart over time (Plan 9, low cost, high screenshot value)
- Streak insurance / freeze (Plan 9, retention hack)
- Real-time gentle correction toggle (Plan 9 or 10)

**The features I'd resist:**

- Multiplayer/leaderboard, tutor marketplace, structured course tree, B2B, iPad/Watch native apps.

**The non-product bet that matters most:** pick ONE distribution channel (TikTok, Reddit, Twitter, YouTube) and post weekly for 6 months. Without distribution, the best product earns 0 paid users.

**The single biggest risk:** Bruno burnout. Mitigation = 3–4 week plan max, public commit dates, real breaks between plans.

**Decision points for tomorrow** are listed in Section 7. The biggest one is **#1: who's the launch persona?**
