# Pre-launch backlog

> Living backlog of **feature- and bug-level** items to address before / around going to prod.
> Ordering reflects Bruno's priority: **features first, bugs last.** Captured 2026-06-09.
>
> This doc is the durable record; the live board lives in **Linear** (mirrored from here — I maintain the cards).
> For the broader engineering snapshot see [`REMAINING-WORK-2026-06-09.md`](./REMAINING-WORK-2026-06-09.md); items that overlap are cross-linked rather than duplicated.
>
> **Altitude:** feature- and bug-level only — implementation-task detail belongs in `docs/superpowers/plans/`, not here.

Legend — Type: 🐛 bug · ✨ feature · 💰 monetization · 🎬 marketing · ❓ open question.

---

## ✅ Status audit — 2026-07-05

Verified against the codebase (not checkboxes). **Most of the original backlog is shipped.** Status: ✅ done · 🟡 partial · ⬜ not done.

| #   | Item                             | Status | Note (if not done)                                                                                                                                    |
| --- | -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Time-limit gate + warm screen    | 🟡     | Start gate exists but no `MIN_SESSION_START_SECONDS` warm threshold; no-entitlement users skip the start gate; `daily-limit.tsx` has no animated Lisa |
| 2   | Wire subscriptions (RevenueCat)  | ✅     | Purchasable + entitlements + gates end-to-end                                                                                                         |
| 3   | Time caps + ad unlock            | ✅     | Enforced server-side (per **day**, not per session)                                                                                                   |
| 19  | Real rewarded ad                 | 🟡     | Real AdMob client wired; server-side ad verification (SSV) still a stub                                                                               |
| 4   | Share carries install link       | ✅     | All three share types include the link                                                                                                                |
| 5   | Like a quote → save              | 🟡     | Like/persist works; **no collection screen** to browse liked quotes                                                                                   |
| 6   | Share-app / leave-review prompt  | ✅     | Store-review prompt + profile share row                                                                                                               |
| 7   | Word deck: source sentence       | ✅     | Captured + shown in deck/review                                                                                                                       |
| 8   | Prompt improvement               | ⬜     | No dedicated quality pass yet (`packages/shared/src/prompts.ts`)                                                                                      |
| 9   | Avatar / picture upload          | ⬜     | Only generated initial-circle; no image picker                                                                                                        |
| 10  | App UI i18n                      | ⬜     | No i18n framework in mobile; UI is hard-coded EN                                                                                                      |
| 11  | Promotional videos               | ⬜     | No video assets                                                                                                                                       |
| 12  | Audio stop on navigation         | ✅     | `stopAllPlayback()` on blur                                                                                                                           |
| 13  | Interrupt coach voice (barge-in) | ✅     | Done for push-to-talk; Live WS mode still lacks it                                                                                                    |
| 14  | Timer never stops                | ✅     | Timer pauses on blur / end                                                                                                                            |
| 15  | Greeting voice ≠ session         | ✅     | Both resolve the same voice (BRU-19)                                                                                                                  |
| 16  | Lisa deep persona                | ⬜     | Only a name + tone; no canon                                                                                                                          |
| 17  | Shared images black border       | ✅     | Shadow removed from captured node (minor rounded-corner residue possible)                                                                             |
| 18  | "Discover Lisa" game             | ⬜     | Blocked on #16                                                                                                                                        |
| 20  | Tap-to-save word only + hint     | ✅     | Per-word tap + first-run hint                                                                                                                         |
| 21  | Goal celebration toast           | ✅     | Non-blocking toast, confetti kept                                                                                                                     |
| 22  | Save conversations               | ✅     | Full transcripts persisted + viewable                                                                                                                 |
| 23  | Spaced-repetition review         | ✅     | Leitner SRS scheduler                                                                                                                                 |
| 24  | Save words with article          | ✅     | `der Tisch` etc., LLM-derived                                                                                                                         |
| 25  | Share link clickable             | ✅     | Isolated-line link treatment                                                                                                                          |
| I1  | Gemini preview voices?           | ✅     | Resolved — they're GA voices, nothing to remove                                                                                                       |
| I2  | Notifications strategy           | 🟡     | Infra + onboarding drip exist; **missing recurring/inactivity re-engagement + prefs UI** → now tracked as **#27**                                     |

**Still open:** 1 🟡, 19 🟡, 5 🟡, 8, 9, 10, 11, 16, 18, plus new #26 & #27 below.

---

## 🟢 NOW — the headline pre-launch push

### 26. ✨ Continuous conversation — one infinite thread per language (WhatsApp-style) _(in progress 2026-07-05)_

Today every Practice open creates a new conversation row, wipes the chat, and replays the greeting — so you "start over" every time, which feels unnatural. Make free-form practice **one continuous thread per language**: re-opening shows your prior messages and continues, **no greeting on re-entry** (greet once on the very first conversation for a language), coach continues with context. Feedback + coach-memory + streak decouple from "session end" into a **"Wrap up & get feedback" checkpoint** (doesn't clear the chat) plus an **auto-checkpoint on 30-min inactivity** so closing the app still earns them. Role-play scenarios keep today's behavior (separate, in-character, explicit end). Quotas unaffected (daily wall-clock cap still bounds the thread). → **Spec:** [`docs/superpowers/specs/2026-07-05-continuous-conversation-design.md`](./superpowers/specs/2026-07-05-continuous-conversation-design.md).

### 1. 💰🐛 Time-limit gate — hard block + warm "limit reached" screen

_Root cause found + design drafted 2026-06-21 (brainstorm, not yet built)._

- **The leak (boundary case):** the server _does_ 429 a fully-capped user at session start (`POST /sessions`), and the client already redirects to the limit screen before the greeting. But `canUseSecondsDaily` allows a session whenever `used < cap` **strictly** — so a user with even 10–20s left passes the gate, hears the greeting, then gets blocked on the first turn. That's the "it let me in, greeted me, then blocked me" confusion. Secondary path: a user with **no entitlement row** skips the start gate entirely (`voice.ts` `if (entitlement)`).
- **Fix (hard block):** add `MIN_SESSION_START_SECONDS` (~30s, in `env.ts`) and in `POST /sessions` return the same `429 DAILY_QUOTA_EXCEEDED` when `remaining = cap - used < MIN_SESSION_START_SECONDS`. Reuses the existing client `mode:"restart"` redirect — no client logic change, the greeting just never plays.
- **Warm screen:** rebuild `app/(modals)/daily-limit.tsx` to reuse the celebration look — the animated Lisa Lottie (`assets/avatar.json`) delivering the Pro invitation herself in a speech bubble (warm, motivating, no AI-vs-human framing). Keep the countdown, Go-Pro CTA, watch-ad option, `resume`/`restart` modes, isPro auto-dismiss, and server-cap-driven messaging (free vs. the Pro-at-60min variant, which gets no upsell). No confetti/sound here (it's an upsell, not a reward) — just a soft fade-in.

Tightly coupled to subscriptions/feature-gates below (the gate is what enforces the cap).

### 2. 💰 Wire subscriptions — resume RevenueCat

RevenueCat was **started then stopped halfway** — this is _resume_, not start-from-scratch. Finish the Plan 8 monetization loop end-to-end: subscriptions purchasable, entitlements read, **feature gates** wired through the app. Extends [`REMAINING-WORK` §D](./REMAINING-WORK-2026-06-09.md).

### 3. 💰 Time caps + rewarded-ad unlock

- **Free:** 5 min per session, with **+3 min** unlock by watching a rewarded ad, **or** Pro subscription to remove the cap.
- **Pro:** 60 min.

Depends on #1 (enforcement) and #2 (entitlements). The rewarded-ad **wiring** is broken out as #19 (currently a stub).

### 19. 💰🐛 Wire the real rewarded ad — currently a stub _(wanted in the next build)_

The "Watch an ad for +3 min" flow calls `adExtension()`, which **grants the +3 min server-side immediately with no actual ad** (`app/(modals)/daily-limit.tsx` — explicitly marked STUB). Wire a real rewarded-ad SDK so the grant only happens after a completed ad view. Bruno wants this in the **next build**. Depends on #3 (caps/unlock plumbing already exists).

### 4. ✨ Sharing — with an install / marketing link every time

The common thread: **every share must carry a way to get the app** (install link or link to the marketing site `mylanguagecoach.app`).

- **Share a quote** → include link to the marketing site.
- **Share a conversation** → _already exists, needs improving_; add an install link.
- **Share feedback** (end-of-session feedback) → include an install link.

---

## 🟡 NEXT — supporting features

### 5. ✨ Like a quote → save liked quotes

A "like" button on quotes that saves them to a personal collection.
**Open question:** what do we do with the saved-likes data later? (surfacing, a "favourites" screen, signal for personalization?) — to decide.

### 6. ✨ "Share the app / leave a review" growth prompt

Prompt happy users to share the app or leave a store review. Growth/ASO loop — relates to the **aso** and **referrals** skills.

### 7. ✨ Word deck — always show the example phrase / review in context

For every saved word, always include **the phrase/sentence where the word was found** as an example, not just the word in isolation. _(Bruno 2026-06-21:)_ this is also how he wants to **review** — show the original sentence from the conversation the word came from, so review happens in context, not as isolated words. (Capture the source sentence at save time — ties into #20's word-only selection.)

### 8. ✨ Prompt improvement

A quality pass on the coach prompt(s).

### 9. ✨ App personalization — avatar / picture

Avatar / profile-picture upload, possibly more personalization later. Extends [`REMAINING-WORK` §B](./REMAINING-WORK-2026-06-09.md) (avatar upload confirmed not done).

### 10. ✨ App UI language (i18n)

UI translated into the supported languages + a language selector in Profile. Already tracked in [`REMAINING-WORK` §C](./REMAINING-WORK-2026-06-09.md) — linked here, not duplicated.

### 11. 🎬 Promotional videos

Produce promo videos for the app (store listing / marketing / social). Relates to the **video** and **aso** skills.

### 27. ✨ Friendly-reminder / re-engagement notifications _(upgraded from I2)_

Prevent early churn — nudge people back after they download so they don't stop using the app. **Infra already exists** (verified 2026-07-05): `expo-notifications`, `push_tokens`/`push_schedule` tables, a 60s `push-runner`, and a Day-1/2/7 onboarding drip (`push-scheduler.ts`). **What's missing:** recurring practice/streak reminders, **inactivity-triggered re-engagement** ("you haven't practiced in N days"), anything beyond day 7, and a **notification-preferences/opt-out toggle** in Profile. Tie the messaging into the **churn-prevention** skill (retention nudges, not just reminders). Pairs with #26 (a lapsed thread is a natural re-engagement hook).

### 20. ✨🐛 Tap-to-save word — select the word only + make it discoverable

Two parts:

- **Selection:** tapping a message to save a word to the deck currently **pre-selects the whole sentence**. Pre-select **just the tapped word** instead (much better). Files: `MessageBubble.tsx` + the vocab-save flow.
- **Discoverability:** nobody knows you can tap a message to save a word. Add some guidance (first-run hint / affordance) so the feature is findable. _(Bruno 2026-06-21.)_ Feeds the source-sentence capture in #7.

### 21. ✨🐛 Goal celebration — small non-blocking popup, stay in the conversation

The goal-reached celebration (`src/features/practice/goal-reward.tsx`) is **too invasive** — it's a full-screen overlay that interrupts the conversation for ~4s. Make it a **small popup/toast that doesn't stop the conversation and doesn't leave the practice screen**. Keep the confetti and sound; use a **smaller avatar** that fits the popup. _(Bruno 2026-06-21.)_

### 22. ✨ Save the conversations themselves, not just the feedback

Today only end-of-session **feedback** is persisted/reviewable. Bruno wants the **full conversation transcripts** saved too. Re-point "Recent sessions" so it opens the **past conversation**, and from there reach its feedback — **or** save conversations only and let the user **generate feedback on demand with a button**. _(Bruno 2026-06-21 — decide which model.)_ Touches `sessions/recent`, the chooser's recent-session rows (`practice.tsx`), and `end-of-session`.

### 23. ✨ Word deck — science-based spaced-repetition review

The deck has no review scheduling: with 100+ German words there's no way to actually get through them. Add a **pedagogically sound spaced-repetition** flow — review a sensible **amount per day** and rotate items in a research-backed order (e.g. SM-2/Leitner-style intervals). _(Bruno 2026-06-21.)_ Pairs with #7 (review in context).

### 16. ✨❓ Lisa — deep, evolving human-like persona

Give Lisa (the default coach) a consistent, realistic life — a home city, family (e.g. husband, children), hobbies, a personal history she can recount — and let it evolve believably over time. Makes the relationship mutual (memory already runs one way) and lifts retention. **Open questions / guardrails:** canon as a single source of truth in `packages/shared` prompts (bounded, curated evolution — not free LLM invention); per-language home vs. fixed home with travel stories; honor the no-AI-vs-human rule (warm character, honest she's a coach if asked). Needs a brainstorm + spec. Idea credit: Bruno's girlfriend (2026-06-11). → **Linear BRU-23.**

### 18. ✨❓ "Discover Lisa" — gamified persona (100 facts to uncover)

A light meta-game on top of the persona (#16): ~100 facts to discover about Lisa, easiest → most secret, each discovery = 1 point. A collection/achievement layer that pulls users back, drives sharing, and forces more questions. **The genius:** the game action _is_ the learning action — to unlock a secret you must ask a good question and understand the answer in your target language. Stacks on coach-memory extraction (tag "turn revealed fact #N"), the share system (#4 — "47/100 discovered" cards), and the persona canon (#16 _is_ the 100-fact ledger). **Open questions:** anti-dump (Lisa deflects "list everything"; secrets gated behind trust/level); detection & a "Lisa dossier" X/100 screen; 100 levels vs 100 facts; extensibility (husband/kids as their own characters → chapters); free hook vs Pro perk. Depends on #16; needs its own spec. Idea credit: Bruno (2026-06-11). → **Linear BRU-25.**

---

## 🔴 LATER — bug polish (after the feature push, but they still matter)

These make the app "sound really buggy" — deliberately scheduled after the feature push per Bruno, but tracked so they don't get lost.

### 12. 🐛 Audio doesn't stop on screen navigation

Any sound must **stop immediately** when navigating from one screen to another. Today it keeps playing and feels buggy.

### 13. 🐛 Can't interrupt the coach voice

The user should be able to **barge-in / interrupt** the coach's voice message at any time. _(Bruno 2026-06-21:)_ one click should **stop the coach mid-message and immediately hand the mic to the user** — no waiting for the full reply to finish playing before they can take their turn.

### 14. 🐛 Timer never stops

A timer keeps running when it shouldn't. _(Likely related to #1 — confirm whether it's the same session timer.)_

### 15. 🐛 Greeting voice ≠ rest of session

The greeting message is spoken with a **different voice** than the rest of the session. Make it consistent.

### 17. 🐛 Shared images have a black border — make exports impeccable

Shared cards (quote / conversation / feedback) export with a black frame around the rounded card instead of a clean edge — visible on every share, a marketing surface. **Root cause:** the captured `cardWrap` has `borderRadius` + `overflow:'hidden'` + a shadow; `captureRef(..., {format:'png'})` grabs the bounding rectangle, so the rounded-corner/shadow margin is transparent → composites to black in WhatsApp & co. **Fix (recommended):** capture the gradient `CardFrame` full-bleed (no rounded corners / no shadow on the captured node) so there's zero transparency. Files: `share-card-modal.tsx`, `share-cards.tsx`. → **Linear BRU-24.**

---

### 24. 🐛 Word deck — save words WITH their article (gender)

German words are saved **without their article** (e.g. `Tisch` instead of `der Tisch`); same problem for French, Italian, and likely other gendered languages. The article carries the gender and is essential to learn the word correctly — capture and store it at save time, and show it in the deck/review. _(Bruno 2026-06-21.)_ Important data-quality bug.

### 25. 🐛 Share conversation / feedback — link isn't clickable

When sharing a **quote**, the marketing-site link is clickable. When sharing a **conversation** or **feedback**, the link is **not clickable**. Make every shared link tappable. _(Bruno 2026-06-21.)_ Related to #4 (every share carries an install/marketing link) and #17 (share-card export quality) — same share surfaces.

---

## ❓ Investigations / open questions

### I1. Coach voice-settings — are these Gemini _preview_ voices?

Are the voices offered in **Coach voice settings** the new **Gemini preview** voices? If yes → **remove them**, since preview voices are too limited. _Answerable directly in code (`apps/api` TTS router / `voice-map.ts` + the mobile voice-settings screen)._

### I2. Notifications strategy → churn-prevention

Decide the notifications approach and tie it into the **churn-prevention** skill — i.e. use notifications as retention nudges, not just reminders.
