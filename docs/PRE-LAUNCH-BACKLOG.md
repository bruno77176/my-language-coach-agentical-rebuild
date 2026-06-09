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

## 🟢 NOW — the headline pre-launch push

### 1. 💰🐛 Time-limit gate — fix the UX _and_ verify it enforces

The current behaviour is broken in two ways:

- **UX:** the error message is ugly and fires too late. It should surface **much earlier** and gracefully. _(Bruno flagged this as important.)_
- **Correctness:** it's unclear whether the cap actually **blocks starting another conversation** — it may not be enforcing at all. Verify enforcement, not just the message.

Tightly coupled to subscriptions/feature-gates below (the gate is what enforces the cap).

### 2. 💰 Wire subscriptions — resume RevenueCat

RevenueCat was **started then stopped halfway** — this is _resume_, not start-from-scratch. Finish the Plan 8 monetization loop end-to-end: subscriptions purchasable, entitlements read, **feature gates** wired through the app. Extends [`REMAINING-WORK` §D](./REMAINING-WORK-2026-06-09.md).

### 3. 💰 Time caps + rewarded-ad unlock

- **Free:** 5 min per session, with **+3 min** unlock by watching a rewarded ad, **or** Pro subscription to remove the cap.
- **Pro:** 60 min.

Depends on #1 (enforcement) and #2 (entitlements).

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

### 7. ✨ Word deck — always show the example phrase

For every saved word, always include **the phrase/sentence where the word was found** as an example, not just the word in isolation.

### 8. ✨ Prompt improvement

A quality pass on the coach prompt(s).

### 9. ✨ App personalization — avatar / picture

Avatar / profile-picture upload, possibly more personalization later. Extends [`REMAINING-WORK` §B](./REMAINING-WORK-2026-06-09.md) (avatar upload confirmed not done).

### 10. ✨ App UI language (i18n)

UI translated into the supported languages + a language selector in Profile. Already tracked in [`REMAINING-WORK` §C](./REMAINING-WORK-2026-06-09.md) — linked here, not duplicated.

### 11. 🎬 Promotional videos

Produce promo videos for the app (store listing / marketing / social). Relates to the **video** and **aso** skills.

---

## 🔴 LATER — bug polish (after the feature push, but they still matter)

These make the app "sound really buggy" — deliberately scheduled after the feature push per Bruno, but tracked so they don't get lost.

### 12. 🐛 Audio doesn't stop on screen navigation

Any sound must **stop immediately** when navigating from one screen to another. Today it keeps playing and feels buggy.

### 13. 🐛 Can't interrupt the coach voice

The user should be able to **barge-in / interrupt** the coach's voice message at any time.

### 14. 🐛 Timer never stops

A timer keeps running when it shouldn't. _(Likely related to #1 — confirm whether it's the same session timer.)_

### 15. 🐛 Greeting voice ≠ rest of session

The greeting message is spoken with a **different voice** than the rest of the session. Make it consistent.

---

## ❓ Investigations / open questions

### I1. Coach voice-settings — are these Gemini _preview_ voices?

Are the voices offered in **Coach voice settings** the new **Gemini preview** voices? If yes → **remove them**, since preview voices are too limited. _Answerable directly in code (`apps/api` TTS router / `voice-map.ts` + the mobile voice-settings screen)._

### I2. Notifications strategy → churn-prevention

Decide the notifications approach and tie it into the **churn-prevention** skill — i.e. use notifications as retention nudges, not just reminders.
