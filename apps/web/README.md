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

| Name                        | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_IOS_URL`       | iOS install URL (TestFlight join URL, later App Store URL). |
| `NEXT_PUBLIC_ANDROID_URL`   | Android install URL (Play Store details URL).               |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Footer "Contact" link.                                      |
| `NEXT_PUBLIC_SITE_URL`      | Used as `metadataBase` for absolute OG/canonical URLs.      |

All four have safe defaults in code, so local dev works without `.env.local`.

## TestFlight public link expires every ~90 days

The iOS URL points to a TestFlight public-test join link. **These expire after 90 days and cap at 10,000 testers.** When the link breaks:

1. Generate a new public-test URL in App Store Connect → TestFlight → External Testing.
2. Update `NEXT_PUBLIC_IOS_URL` in the Vercel project's Environment Variables (Production + Preview).
3. Redeploy (Vercel does this automatically on env-var change).

Total: ~5 minutes. No code change needed.

## Production deployment

Auto-deployed to Vercel from `main`. PR branches get preview deploys.

Custom domain: `mylanguagecoach.app`, purchased on Porkbun, pointed at Vercel's DNS.

## Architecture

See `docs/superpowers/specs/2026-05-27-landing-page-design.md` (spec) and `docs/superpowers/plans/2026-05-27-landing-page.md` (this plan's history).

## Marketing assets

See `public/ASSETS-NEEDED.md` for the list of placeholder assets that still need real captures before launch (phone screenshots, character PNG, OG image, real multi-res favicon).
