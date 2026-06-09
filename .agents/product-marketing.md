# Product Marketing Context

_Last updated: 2026-06-08 — V1, reviewed & corrected by Bruno_

> This document is the shared foundation other marketing skills (aso, copywriting, pricing, paywalls, launch, etc.) read from. Keep it accurate. Items marked ⚠️/TBD need Bruno to confirm or fill.

## Product Overview

**One-liner:** An AI voice coach you talk with to practice real conversations and build speaking confidence — in 15 languages.
**What it does:** You have spoken conversations with an AI language coach that _remembers you_ (your level, what you've covered, what to revisit), runs real-life role-plays (order coffee, hotel check-in, survive a job interview), and gives you feedback after every chat. Replies are near-instant and natural, with multiple voices to choose from.
**Product category (the "shelf"):** AI language-speaking / conversation-practice app. How people search: "AI to practice speaking [language]", "language tutor app", "Duolingo alternative for speaking", "AI language partner".
**Product type:** B2C mobile app (iOS + Android), subscription SaaS.
**Business model:** Freemium, deliberately tight on the free side because AI voice is expensive to serve.

- **Free:** $0, no card, no trial. **5 min/day** of voice. When it runs out: **"watch an ad for +3 min,"** then **"subscribe to unlock."** Access to 3 starter scenarios only (coffee, directions, party).
- **Pro:** **$7.99/mo or $49.99/yr (save 48%).** Unlocks all 10 scenarios and native voices — but still **capped at 1 h/day** of voice (cost control, not a teaser limit).
- Monetization "tripod": tight free cap + rewarded ads (the +3 min) + Pro subscription.

## Target Audience

**Who:** Adult self-directed language learners who can already study/read a bit but **freeze when they have to speak**. Motivated by an upcoming trip, a move abroad, a job, heritage/family ties, or just wanting to finally hold a conversation.
**Decision-makers:** N/A — B2C, the learner buys for themselves.
**Primary use case:** Get private, low-stakes speaking practice and build confidence, without the cost, scheduling, or intimidation of a human tutor.
**Jobs to be done:**

- "Help me get comfortable speaking before my trip / move / interview."
- "Give me a judgment-free place to practice out loud, anytime."
- "Help me keep improving with feedback, so I actually progress instead of plateauing."
  **Use cases / scenarios:** Travel prep, expat/immigrant daily-life rehearsal, job-interview prep, exam conversation practice, maintaining fluency between trips. The 10 shipped role-plays (from `role-play-scenarios.ts`):

| Scenario                       | Register                               | Free / Pro |
| ------------------------------ | -------------------------------------- | ---------- |
| Ordering coffee or food        | Casual café                            | **Free**   |
| Asking for directions          | Stranger on the street                 | **Free**   |
| Small talk at a party          | First meeting, casual                  | **Free**   |
| Hotel check-in                 | Polite formal (reservation hiccup)     | Pro        |
| Doctor visit                   | Describe symptoms, follow instructions | Pro        |
| Job interview                  | Formal, one hard question              | Pro        |
| Customer-service complaint     | Assertive but polite                   | Pro        |
| Phone call with a friend       | Fast, casual, contractions             | Pro        |
| Workplace meeting intro        | Polite professional                    | Pro        |
| Lost passport — police station | Stressed formal, under pressure        | Pro        |

## Personas

B2C single-user product — formal B2B personas N/A. Rough learner segments (⚠️ confirm priority order):
| Segment | Cares about | Challenge | Value we promise |
|---|---|---|---|
| Traveler | Sounding OK on an upcoming trip | Crams, then freezes in the moment | Rehearse the exact situations before you go |
| Expat / immigrant | Daily life in a new country | Anxiety in real interactions | Safe daily practice that builds real confidence |
| Professional | Speaking for work/interviews | No time/budget for a tutor | On-demand practice that fits a schedule |
| Heritage / hobby learner | Reconnecting, personal goal | Plateaued on gamified apps | Real conversation that finally moves the needle |

## Problems & Pain Points

**Core problem:** "I can understand and read, but I freeze the moment I have to actually speak." No safe, affordable, always-available place to practice out loud.
**Why alternatives fall short:**

- Duolingo / gamified apps → build streaks and vocab, not real speaking ability.
- Human tutors (italki/Preply) → effective but expensive, require scheduling, and feel intimidating/high-stakes.
- ChatGPT/Gemini voice → general-purpose, no language-level memory, no structured feedback, not built for learning.
  **What it costs them:** Months/years of study but still can't hold a conversation; embarrassment in real situations; wasted travel and missed connections.
  **Emotional tension:** Fear of judgment and embarrassment, self-doubt, frustration at lack of progress.

## Competitive Landscape

**Direct (AI speaking apps):** Speak, TalkPal, Duolingo Max (voice), Babbel/Busuu speaking features. _(Confirmed head-to-heads.)_
**Secondary (human tutors):** italki, Preply — same job (learn to speak), different approach; expensive + scheduling.
**Indirect:** Language-exchange apps (Tandem, HelloTalk), in-person classes, or doing nothing/passive content.
_Each falls short:_ gamified apps don't produce speaking ability; tutors are costly and intimidating; exchange apps depend on finding/matching real partners; generic AI lacks memory, structure, and feedback.

## Differentiation

**Key differentiators:**

- **Coach memory** — remembers your level and history; every session builds on the last, not a cold start.
- **Real-life role-plays** — practice the actual situations you'll face.
- **Feedback after every chat** — so you improve, not just talk.
- **Near-instant, natural voice** (ElevenLabs Flash v2.5). **Native voices** are wired for English, German, French, Italian, and Spanish; the other languages currently use ElevenLabs' standard "Sarah" voice until native voices are picked for them (in progress).
- **Judgment-free + always available**, at a fraction of a tutor's cost.
- **15 languages.**
  **Why customers choose us:** The only one that combines memory + role-play + feedback + fast natural voice in an affordable, private app — bridging the gap between gamified apps (too shallow) and human tutors (too costly/intimidating).

## Objections

| Objection                                              | Response                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Is talking to an AI really as good as a person?"      | A rehearsal space, not a replacement — available 24/7, judgment-free, and a fraction of the cost, so you can practice as much as you need and feel ready for real conversations with people. |
| "Another subscription?"                                | Free tier needs no card. Pro is cheaper than a single tutor session per month.                                                                                                               |
| "Will it understand me / reply in the right language?" | Yes — natural, native-quality voice per language. _(Resolved: ElevenLabs Flash v2.5 is now the default TTS and reliably speaks the right language; safe to lean on this claim.)_             |

**Anti-persona:** Someone who only wants grammar drills / gamified streaks; or a strictly zero-budget user — ad revenue alone can't fund AI voice, so the model needs some free→Pro conversion.

## Switching Dynamics

**Push:** Plateaued on Duolingo and still can't speak; tutors too expensive/awkward.
**Pull:** Cheap, private, instant speaking practice that remembers you and gives feedback.
**Habit:** The Duolingo streak habit; comfort of passive, low-effort learning.
**Anxiety:** "Will an AI actually help me?" / "Is my voice/data safe?" / "One more app to figure out."

## Customer Language

> ⚠️ **No real customer language yet** — the phrases below are hypotheses written by us, NOT verbatim from users. Replace them with actual quotes from store reviews / user interviews once there's traction. Treat as placeholders, don't quote them as real.
> **How they (likely) describe the problem:**

- "I can understand it but I freeze when I have to speak."
- "I did [app] for a year and still can't hold a conversation."
- "I'm too embarrassed to practice with real people."
  **How they describe us:**
- None yet — collect after launch.
  **Words to use:** practice, confidence, real conversations, role-play, remembers you, feedback, judgment-free, at your own pace.
  **Words to avoid:** "fluent in X days" / overpromises, heavy linguistic jargon, "lessons/drills" framing, and **AI-vs-human / "replaces a tutor or people" framing** — nothing replaces speaking with people. Position the app as filling a gap and easing communication: a judgment-free rehearsal space that prepares you for real conversations, never a substitute for them.
  **Glossary:**
  | Term | Meaning |
  |---|---|
  | Coach | The AI conversation partner |
  | Scenario / role-play | A guided real-life situation to practice |
  | Session | One conversation with the coach |

## Brand Voice

**Tone:** Warm, encouraging, confidence-building — a friendly coach, not a strict teacher.
**Style:** Conversational, supportive, plain language; celebrates small wins.
**Personality:** Encouraging · patient · friendly · approachable · lightly playful (mascot character). Visual identity: "Sunrise" palette (warm, daylight), Fraunces + DM Sans.

## Proof Points

> ⚠️ **No proof points yet — pre-traction.** Don't use social-proof / testimonial / metric claims in marketing copy until there's real data. Currently in iOS TestFlight + Android open beta; only a handful of friends have installed and tried it once or twice. Treat the launch as a true cold start.
> **Metrics:** None real yet (a few friend installs, 1–2 sessions each).
> **Customers / testimonials:** None yet — collect from store reviews / beta users post-launch.
> **Value themes:**
> | Theme | Proof |
> |---|---|
> | Continuity (memory) | "Every session builds on the last — not a cold start." |
> | Real-world readiness | 10 role-play scenarios (coffee, hotel, interview…) |
> | Real improvement | Feedback after every chat |
> | Confidence through voice | Near-instant, natural replies; multiple voices |

## Goals

**Business goal:** Convert the Play Store / store launch into a steady base of active learners and a healthy free→Pro conversion rate; grow to sustainable solo-run revenue.
**Key conversion action:** Install → complete first voice session (activation) → build a daily habit → upgrade to Pro.
**Current metrics:** None yet — pre-launch beta (handful of friend installs).
