# @language-coach/web

Marketing landing page for My Language Coach. EN at `/`, FR at `/fr`.

## Local development

```sh
pnpm install         # from monorepo root
pnpm dev             # from apps/web/
# → http://localhost:3002
```

Copy `.env.example` to `.env.local` and adjust if you want to point at different store URLs locally.

## Tests

```sh
pnpm test            # lib unit tests (store-links, ua-detect, qr, i18n)
pnpm typecheck       # TypeScript strict
pnpm build           # production build
```

There are no component tests — sections are verified by manual smoke and Lighthouse.

## Environment variables

| Name                        | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_IOS_URL`       | iOS install URL (App Store product URL).               |
| `NEXT_PUBLIC_ANDROID_URL`   | Android install URL (Play Store details URL).          |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Footer "Contact" link.                                 |
| `NEXT_PUBLIC_SITE_URL`      | Used as `metadataBase` for absolute OG/canonical URLs. |

All four have safe defaults in code, so local dev works without `.env.local`.

## Store links

The app is live in production on both stores:

- **iOS:** `https://apps.apple.com/app/id6746396786` (App Store)
- **Android:** `https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach` (Google Play)

These are the in-code defaults (`lib/store-links.ts`). To override per-environment, set `NEXT_PUBLIC_IOS_URL` / `NEXT_PUBLIC_ANDROID_URL` in the Vercel project's Environment Variables (Production + Preview); Vercel redeploys automatically on env-var change. **If `NEXT_PUBLIC_IOS_URL` is still set to an old TestFlight join link in Vercel, it will override the code default — update or delete it there.**

## Production deployment

Auto-deployed to Vercel from `main`. PR branches get preview deploys.

Custom domain: `mylanguagecoach.app`, purchased on Porkbun, pointed at Vercel's DNS.

## Architecture

See `docs/superpowers/specs/2026-05-27-landing-page-design.md` (spec) and `docs/superpowers/plans/2026-05-27-landing-page.md` (this plan's history).

## Marketing assets

See `public/ASSETS-NEEDED.md` for the list of placeholder assets that still need real captures before launch (phone screenshots, character PNG, OG image, real multi-res favicon).
