# Marketing site — Speak.com benchmark & improvement plan

**Date:** 2026-06-11
**Reference / model:** https://www.speak.com/fr — Speak (by Speakeasy Labs). Bruno's
north-star for the marketing site: modern, dynamic, smooth scroll animations,
progressive text reveals.
**Reality check:** Speak is a funded company (10M+ downloads, design team). MLC is
a solo indie build. We don't match their scale or social proof — we win on
**authenticity, personality (Lisa), and a warm distinctive identity**. Steal their
_motion and polish_, not their corporate look.

## What Speak does well (worth stealing)

1. **Motion everywhere, tastefully.** Sections fade/slide in on scroll, text reveals
   progressively (staggered), phone mockups feel alive. This is the single biggest
   gap vs us — it's what makes their site feel "expensive."
2. **Crisp hero headline.** "The English app that makes you speak." One idea, bold.
3. **A belief/philosophy beat.** "To learn a language, you must speak it aloud" —
   frames _why_ speaking-first matters before selling features.
4. **Heavy product presence.** App mockups + screenshots throughout; the product is
   the hero.
5. **Stacked social proof.** 4.8★, 10M+ downloads, 8 testimonials, FAQ to kill
   objections. Repeated CTAs (header, hero, mid, final, footer).

## Where we already match them

Our structure is genuinely close: `TopBar → Hero → ValueStrip → Features →
Showcase×2 → HowItWorks → Pricing → LanguagesStrip → FAQ → FinalCta → Footer`.
Good copy scaffold (pain-quote → promise in the hero), real screenshots, 15 locales.
**The bones are good. The site just doesn't _move_.**

## The gap (technical)

`apps/web` has **no animation library** (no framer-motion/GSAP; only a
ScrollDepthTracker for analytics). Everything is static server-rendered Tailwind.
That's why it feels flat next to Speak.

## Recommendations (prioritized for a solo founder)

### P0 — Add a motion layer (the "smooth & dynamic" feel) — highest ROI

- Add **framer-motion**. Wrap sections in a reusable `<Reveal>` that does
  fade + slide-up on `whileInView` (`viewport={{ once: true }}`).
- **Progressive text reveal:** split the hero headline into words/lines and stagger
  their fade-in-up. Stagger list children (value strip, features, FAQ).
- **Hero phones:** subtle entrance + a gentle infinite float; light parallax on
  scroll (`useScroll`/`useTransform` translateY).
- **Micro-interactions:** button hover lift/scale; smooth FAQ accordion.
- **Respect `prefers-reduced-motion`** (accessibility + App/Play reviewers).
- Effort: ~1 focused day. This alone closes most of the perceived gap.

### P1 — Make the product feel alive

- A short **looping muted video/GIF of the voice loop** (a real coached
  conversation) in the hero or first showcase. For a _voice_ app this is far more
  convincing than static screenshots.

### P2 — Social proof, the indie way (no fake numbers)

- Real testimonials from early TestFlight / family-and-friends testers.
- App Store / Play **star rating** once we have reviews.
- Trust signals we _can_ honestly claim: "15 languages · native voices,"
  "powered by GPT-4o," privacy/account-deletion.
- **Founder authenticity** angle — solo-built, human story. Indie = trust, not a
  weakness.

### P3 — Lean into our differentiators (don't just copy Speak)

- **Lisa (mascot/coach)** — Speak has no character. Give Lisa a presence on the
  site; it's warmth + memorability they can't match.
- Keep the **Sunrise** warm identity vs Speak's corporate white/blue — it's
  distinctive; don't sand it off.
- Our positioning ("a rehearsal space that prepares you for real conversations" —
  never AI-vs-human) is a sharper belief beat than Speak's generic one.

## Suggested next step

Implement P0 (framer-motion reveals + progressive hero text + floating phones) as a
single PR on `apps/web`; it's the change that makes the site feel like Speak's.
