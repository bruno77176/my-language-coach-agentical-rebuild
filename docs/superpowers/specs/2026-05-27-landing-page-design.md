# Marketing Landing Page — Design

**Date:** 2026-05-27
**Status:** Approved for planning
**Author:** Bruno + Claude (brainstorming session)

## Why

The mobile app is in TestFlight (iOS) and Google Play open testing (Android). Bruno needs a public web presence that:

1. **Gives prospective testers a single URL to install from** — instead of sharing two raw store/TestFlight URLs in DMs, point everyone to one branded page with QR codes (desktop) or smart store-buttons (mobile).
2. **Establishes brand presence ahead of production launch** — when production app submissions go in, both Apple and Google ask for a marketing URL, a privacy policy URL, and a support URL. Better to ship those now than scramble at submission time.
3. **Owns the `mylanguagecoach.app` domain** — the `.com` is squatter-held at $2,695; the `.app` is $15/yr flat on Porkbun and reads more naturally for a mobile app.

The legacy app's privacy/marketing presence is essentially nonexistent — this is also the canonical "v1" web surface for the rebuilt brand.

## Scope

### In this plan

- New monorepo package `apps/web/` — Next.js 14 (App Router) + TypeScript + Tailwind, mirroring `apps/admin/`.
- One marketing landing page at `/` (English) and `/fr` (French), seven sections each.
- `/privacy` and `/terms` pages with placeholder legal content (real text but explicitly marked as placeholder pending lawyer review).
- Download CTA component with two behaviors: QR codes on desktop, smart store-buttons on mobile (iOS / Android / unknown).
- Store URLs sourced from `NEXT_PUBLIC_IOS_URL` / `NEXT_PUBLIC_ANDROID_URL` env vars so prod-store swap requires no code change.
- Vercel Web Analytics with four custom events: `cta_ios_click`, `cta_android_click`, `language_switch`, `scroll_depth_50`/`scroll_depth_100`.
- Shared design tokens consumed from `@language-coach/design-tokens` so the site visually matches the app.
- Vercel deploy under existing Vercel account, free Hobby tier.
- Domain `mylanguagecoach.app` purchased on Porkbun and pointed at Vercel after Bruno confirms.

### Explicitly deferred

- FAQ section (no real user questions yet — pointless to invent them).
- Testimonials (no real ones).
- Pricing page (free for now, no plan to monetize the landing page yet).
- Blog or changelog.
- Email capture / newsletter.
- A/B testing infrastructure.
- Web-based version of the app.
- Account signup or login on the web.
- Locales beyond EN/FR — `next-intl` migration deferred until a third language is on the roadmap.
- Auto-locale detection from `Accept-Language` or geo-IP — footer language switcher is the only way to flip.

## Architecture

One new app, no new backend. Static pages compiled at build time, served from Vercel's edge.

```
app/apps/web/
├── app/
│   ├── layout.tsx              ← fonts, analytics, hreflang tags
│   ├── page.tsx                ← EN landing page (/)
│   ├── fr/page.tsx             ← FR landing page (/fr)
│   ├── privacy/page.tsx        ← /privacy (renders privacy.en.mdx)
│   ├── fr/privacy/page.tsx     ← /fr/privacy (renders privacy.fr.mdx)
│   ├── terms/page.tsx          ← /terms (renders terms.en.mdx)
│   ├── fr/terms/page.tsx       ← /fr/terms (renders terms.fr.mdx)
│   └── api/health/route.ts     ← simple 200 for uptime checks
├── components/
│   ├── Hero.tsx
│   ├── ValueStrip.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── LanguagesStrip.tsx
│   ├── DownloadCTA.tsx         ← QR (desktop) / store buttons (mobile)
│   ├── Footer.tsx              ← language switcher lives here
│   └── PhoneFrame.tsx          ← reusable phone-bezel wrapper for screenshots
├── lib/
│   ├── i18n.ts                 ← Messages = typeof import('../messages/en.json'); useMessages(locale)
│   ├── store-links.ts          ← reads NEXT_PUBLIC_IOS_URL / NEXT_PUBLIC_ANDROID_URL with safe defaults
│   ├── ua-detect.ts            ← parses User-Agent header server-side, returns 'ios' | 'android' | 'desktop' | 'unknown'
│   └── qr.ts                   ← wraps `qrcode` to emit inline SVG at build time
├── messages/
│   ├── en.json
│   └── fr.json
├── content/
│   ├── privacy.en.mdx
│   ├── privacy.fr.mdx
│   ├── terms.en.mdx
│   └── terms.fr.mdx
├── public/
│   ├── og-image.png            ← derived from apps/mobile/assets/icon.png
│   ├── favicon.ico
│   └── screens/                ← captured PNGs of Home, Practice, Progress
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Data flow:** there isn't one. No API, no DB. All content is bundled at build. Analytics events are fired client-side to Vercel's collector. The only runtime behavior is User-Agent detection in the `DownloadCTA` server component (re-checked client-side once on hydration to survive static caching).

## Page structure

Seven blocks per locale, same order:

| # | Section          | Purpose                                                                                                          |
| - | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1 | Hero             | Headline + sub-headline + primary CTA. Right side: phone screens + character illustration on a Sunrise gradient. |
| 2 | Value strip      | Four icon+label pairs in a row — quick rhythm break before the longer content.                                   |
| 3 | Features         | Three columns, each with a mini phone screen + heading + one sentence.                                           |
| 4 | How it works     | Three numbered steps: pick a language → talk → improve.                                                          |
| 5 | Languages strip  | Visual chips of the languages the app supports today (FR, DE, IT, TR, +more).                                    |
| 6 | Final CTA        | Repeat the DownloadCTA — last impression before footer.                                                          |
| 7 | Footer           | Logo, copyright, /privacy + /terms links, language switcher (EN ⇄ FR), contact email link.                       |

## Visual system

All values pulled from `@language-coach/design-tokens` so the site reads as a sibling of the app.

| Token         | Value                                | Use                                              |
| ------------- | ------------------------------------ | ------------------------------------------------ |
| Background    | `#fbf6ec` (cream)                    | Page background                                  |
| Hero gradient | Sunrise: `#fde7d1 → #f6c7b1 → #d9b4c7` | Hero section only, soft diagonal                 |
| Accent        | `#d96b5b` (coral)                    | Primary buttons, links, QR-code frame            |
| Accent deep   | `#a04130`                            | Button hover/active                              |
| Ink           | `#2b1d12`                            | Body text                                        |
| Glass         | `rgba(255,255,255,0.55)`             | Card surfaces over the gradient                  |
| Display font  | Fraunces 700                         | Headlines, section titles                        |
| Body font     | DM Sans 400/500                      | Everything else                                  |

**Layout rhythm:** max content width ~1140px, sections separated by 96–128px of vertical space. Subtle dot decorations near the hero (echoing the inspiration image) used restrainedly.

**Tone of copy:** warm, second-person ("you"), short sentences. Less marketing-speak, more "talk to it and it talks back." EN drafted by Claude, machine-translated to FR then tightened with Bruno (native FR speaker).

## DownloadCTA mechanics

The same component is rendered in the hero and the final CTA section. Single source of truth for store-link behavior.

**Inputs (env vars, both with safe defaults committed to source so local dev works):**

```
NEXT_PUBLIC_IOS_URL=https://testflight.apple.com/join/yU7XNGSS
NEXT_PUBLIC_ANDROID_URL=https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach
```

**Behavior matrix:**

| Viewport        | UA detection | What renders                                                                       |
| --------------- | ------------ | ---------------------------------------------------------------------------------- |
| ≥1024px         | any          | Two QR codes side by side, framed coral. Caption text + raw URL fallback below each. |
| <1024px         | iOS          | Single full-width "Get it on TestFlight" button → iOS URL.                          |
| <1024px         | Android      | Single full-width "Get it on Google Play" button → Android URL.                     |
| <1024px         | unknown      | Both buttons stacked vertically.                                                   |

**Implementation notes:**

- UA detected server-side via Next.js `headers()` for first paint, re-checked once in `useEffect` to survive static caching. Both code paths render in HTML; CSS hides the wrong one.
- QR codes generated at build time as inline SVG using the `qrcode` npm package. No runtime network calls, no third-party QR APIs.
- iOS button shows a small note: *"TestFlight beta — limited spots"* — sets expectations if the public-test cap hits or the link expires.

## TestFlight expiry mitigation

TestFlight public beta links **expire after 90 days** and cap at 10,000 testers. If the link breaks while the landing page is live, iOS users hit a dead end. Mitigations:

1. **Env-var-driven URL** — swap takes 30 seconds (Vercel dashboard → env var → redeploy).
2. **Visible "limited spots" note** under the iOS CTA — sets expectation.
3. **README note in `apps/web/`** documenting the 90-day cadence so the next person (including future-Bruno) knows to renew.

Not in scope: automatic detection of a dead TestFlight link, fallback to "join waitlist" form, etc.

## i18n

Two routes (`/` and `/fr`), same components, swapped messages. No framework.

- `messages/en.json` and `messages/fr.json` hold every visible string keyed by section (e.g. `hero.headline`, `features.f1.title`).
- `lib/i18n.ts` exports `useMessages(locale)` returning the typed map. Type derived from `typeof import('../messages/en.json')` so missing FR keys fail TypeScript build.
- Locale read from the route segment — no client detection, no cookies, no auto-redirect.
- Each page sets `<html lang>` and the layout emits `<link rel="alternate" hreflang="en" href="..." />` + `hreflang="fr"` + `hreflang="x-default"` so Google indexes both versions.
- Footer has a single language switcher button that swaps `/` ⇄ `/fr` while preserving the path (e.g., `/privacy` ⇄ `/fr/privacy`).

When a third locale is added: add `messages/<locale>.json`, add the route folder, update the language switcher's locale list. No framework migration unless we hit five+ locales.

## Privacy & Terms

Both ship with **real placeholder content**, not Lorem ipsum, but the top of each file carries a visible banner:

> *This document is a draft. Final legal review pending.*

**Privacy policy covers:**

- What's collected: Supabase auth email, practice session metadata, voice audio transmitted to OpenAI for transcription.
- Third parties: Supabase, OpenAI, Google Cloud TTS, Vercel Web Analytics (anonymous page-view counts only, no cookies).
- Data retention and user rights (delete account in-app).
- Contact email for privacy questions.

**Terms covers:** generic SaaS terms adapted for a free beta — service-as-is, no warranty, account termination, governing law TBD.

Both pages rendered from MDX so legal text can be edited without touching component code. Linked from the footer on every page.

**Stated limitation:** Claude is not a lawyer. Drafts are reasonable starting points so the URLs return professional content for app submission; before production submission Bruno should have someone qualified review them (especially the voice-data and GDPR sections).

## Analytics

**Vercel Web Analytics** — one component (`<Analytics />`) in the root layout, one toggle in the Vercel dashboard. No cookies, GDPR-friendly, free tier covers ~2.5k visits/month.

**Custom events:**

| Event                | Fires when                                                |
| -------------------- | --------------------------------------------------------- |
| `cta_ios_click`      | iOS button or iOS QR caption-link clicked                 |
| `cta_android_click`  | Android button or Android QR caption-link clicked         |
| `language_switch`    | Footer EN ⇄ FR toggle used (event payload: `to: 'en'` or `'fr'`) |
| `scroll_depth_50`    | User has scrolled past 50% of page height (once/session)  |
| `scroll_depth_100`   | User has reached page bottom (once/session)               |

No heatmaps, no session replay, no tag manager.

## Deployment & domain

**Vercel project:**

- New project `language-coach-web` under Bruno's existing Vercel account.
- Connected to monorepo GitHub repo; Root Directory set to `apps/web`.
- Production branch `main`. Preview deploys on every PR.
- Free Hobby tier.

**Build:** Turbo handles it (`turbo run build --filter=@language-coach/web`); Vercel runs `pnpm install && pnpm build`. No GitHub Actions needed for the site.

**Env vars (set in Vercel dashboard, Production + Preview):**

```
NEXT_PUBLIC_IOS_URL=https://testflight.apple.com/join/yU7XNGSS
NEXT_PUBLIC_ANDROID_URL=https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach
NEXT_PUBLIC_CONTACT_EMAIL=bruno.a.moise@gmail.com
```

**Domain rollout:**

1. **Day 0:** site lives at `language-coach-web.vercel.app`. QR codes work immediately.
2. **Whenever ready:** Bruno buys `mylanguagecoach.app` on Porkbun (~$15/yr, flat renewal). Adds it in Vercel project's Domains tab → Vercel returns DNS records → paste into Porkbun. SSL provisioned automatically. ~10 minutes, no code changes.

## Assets to produce

| Asset                       | Source                                              | Owner   |
| --------------------------- | --------------------------------------------------- | ------- |
| 3 phone screenshots         | Captured from running dev build (Home/Practice/Progress) | Claude  |
| Character illustration      | Static PNG exported from `apps/mobile/assets/avatar.json` (Lottie). Live Lottie deferred — adds bundle weight for marginal value on a landing page. | Claude |
| Favicon                     | Derived from `apps/mobile/assets/icon.png`          | Claude  |
| Open Graph image (1200×630) | Derived from icon + tagline                         | Claude  |
| English copy                | Draft from Play Store description + Claude rewrite  | Claude  |
| French copy                 | Machine-translated EN, then refined with Bruno      | Bruno + Claude |

Nothing new commissioned; everything reuses existing brand assets.

## Bruno's manual steps

These cannot be done from code. Listed so they don't get forgotten.

1. Buy `mylanguagecoach.app` on Porkbun. Add to Vercel.
2. Enable Vercel Web Analytics in dashboard (one toggle).
3. Review placeholder privacy/terms drafts; decide whether to engage a lawyer before production app submission.
4. Decide whether to use `bruno.a.moise@gmail.com` or a dedicated `hello@mylanguagecoach.app` for the contact link.
5. Renew the TestFlight public-test link every ~90 days (or update the env var when it changes).

## Out of scope (explicit, to prevent scope creep mid-build)

- Account signup/login on the web.
- Web-based version of the app itself.
- Email capture / newsletter.
- Pricing page.
- Blog or changelog.
- FAQ section.
- Testimonials.
- A/B testing infrastructure.
- Auto-locale detection.
- Locales beyond EN/FR.
- Live Lottie animation for the character (static PNG export only).
- Automatic dead-link detection for the TestFlight URL.

## Success criteria

- `apps/web/` builds cleanly via `turbo run build --filter=@language-coach/web` and via Vercel's CI.
- Deployed site loads at `language-coach-web.vercel.app` with Lighthouse Performance ≥ 90 and Accessibility ≥ 95 on a desktop run.
- Scanning either QR code from a phone opens the correct store/TestFlight page.
- On an iPhone, visiting the site shows only the iOS button (no QRs, no Android button). Same logic verified for Android.
- Switching to `/fr` swaps every visible string; switching back preserves the current path.
- `/privacy` and `/terms` return real content (not 404, not Lorem ipsum) in both locales.
- Vercel Web Analytics dashboard shows page views and at least one custom event after smoke-testing.
