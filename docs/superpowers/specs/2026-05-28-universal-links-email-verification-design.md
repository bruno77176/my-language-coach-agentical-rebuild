# Universal Links + App Links for Email Verification — Design

**Date:** 2026-05-28
**Status:** Approved for planning
**Author:** Bruno + Claude (brainstorming session)

## Why

A friend exploited a Supabase auth-config gap to sign up as `bruno.moise@gmail.com` (an email he doesn't own). Two-layer failure: the Supabase project's "Confirm email" toggle was OFF (auto-confirming every signup), and `apps/api/src/lib/supabase-verifier.ts` didn't double-check `email_confirmed_at`. Both fixes shipped earlier in this session (toggle flipped; verifier hardened with a unit test).

Re-enabling email confirmation exposed the next problem: the confirmation link in the email uses a **custom URL scheme** (`mylanguagecoach://verify`). Custom schemes fail for at least three classes of users:

1. **Corporate-managed devices** (Intune, Google Workspace MDM, BYOD profiles) refuse the protocol switch from a managed email app to a non-managed app. Bruno hit this himself when testing — the OS blocked the link.
2. **Some email clients** silently rewrite or strip custom-scheme links (Outlook web, some Gmail variants).
3. **Android intent dispatching** can drop URL fragments (`#access_token=…`) when handing off to apps via custom schemes, which is exactly where Supabase puts the auth tokens.

These aren't bugs we can patch — they're inherent limitations of the custom-scheme deep-link mechanism. The industry-standard production fix is **Universal Links (iOS)** + **App Links (Android)**: the email contains a normal HTTPS URL on a domain you own (`https://www.mylanguagecoach.app/auth/verify?…`), and the operating system silently opens the app when the device's OS has previously verified that the app and the domain belong to the same publisher. If anything goes wrong (app not installed, OS-level verification not yet complete), the HTTPS URL falls through to a real web page under your control.

This also unblocks the Play Console production push planned for this week — without it, the first real user who signs up via a corporate email never gets in.

## Scope

### In this plan

- **`apps/web`**: serve two well-known JSON files (`apple-app-site-association` for iOS, `assetlinks.json` for Android) and a fallback `/auth/verify` page.
- **`apps/mobile`**: declare `associatedDomains` (iOS) and `intentFilters` (Android) so the OS associates `https://www.mylanguagecoach.app/auth/*` with the app. Bump `versionCode 41→42` and iOS `buildNumber 7→8`.
- **Supabase Dashboard**: add `https://www.mylanguagecoach.app/auth/verify` to the redirect-URL allowlist. Keep the existing `mylanguagecoach://verify` entry in the list for transitional rollback safety.
- **Build + ship**: `eas build` for both platforms (production profile); submit Android AAB to Play Console internal testing; submit iOS IPA to TestFlight (Bruno tests via friend's iPad).
- **Verification**: confirm AASA + assetlinks endpoints return correct JSON via curl; confirm `email_confirmed_at` flips on real signup; confirm app opens directly from a real device click without falling back to the web page.
- **Bonus cleanup (separate, not gating)**: delete the two known-fraudulent auth users (`bruno.moise@gmail.com` → uuid `e6dafbbc-…`, `albeniz_77@hotmail.com` → uuid `87f80fe2-…`). Both signed up on 2026-05-28 within an hour, both attributable to the friend's testing.

### Explicitly deferred

- **Marketing landing page redesign** — `/auth/verify` is a separate route; we don't touch `/`, `/fr`, `/privacy`, `/terms`.
- **Desktop browser auth** — the product is a mobile app. `/auth/verify` shows a "Open My Language Coach on your phone" message rather than completing the auth in the browser.
- **Password-reset / change-email / magic-link deep links** — these also currently use `mylanguagecoach://` and have the same MDM issue, but we're scoping tonight's plan to the signup-confirm path. Same plumbing (`/auth/*`) will accommodate them later by adding one path-prefix per flow to the well-known files; no app change needed.
- **Unifying the iOS bundle ID and Android package** (`com.brunomoise.mylanguagecoach` vs `com.anonymous.mylanguagecoach`). Asymmetric but harmless; rename is a separate, app-store-disruptive operation.
- **Apex-domain serving** — we deliberately use the `www.` subdomain to avoid the existing apex→www 307 redirect that would break iOS Universal Links (the OS won't follow redirects fetching `apple-app-site-association`). Switching to apex would require a Vercel project-settings change and is YAGNI tonight.
- **Migrating remaining 10 instant-confirmed email accounts** — they're already confirmed in the DB so the new gate doesn't lock them out, and most belong to Bruno or his immediate testing circle. If any turn out to be unknown strangers, individual deletion is a one-line DB call later.

## Architecture

### URL pattern in the email

```
https://www.mylanguagecoach.app/auth/verify?token=<token>&type=signup&redirect_to=...
```

Supabase generates this URL by combining the "Site URL" field (which we'll set to `https://www.mylanguagecoach.app`) with the `/auth/verify` path. The token is single-use and lives ~24h.

### What happens when the user taps the link

```
User taps link in email
        │
        ▼
OS sees HTTPS URL on www.mylanguagecoach.app
        │
        ├─ Has the OS already verified this app for this domain?
        │     ├─ YES → opens the app directly, deep-linking to the
        │     │        existing `apps/mobile/app/(auth)/verify.tsx`
        │     │        screen with the full URL (including query string)
        │     │
        │     └─ NO  → browser opens the URL, hits the Next.js page at
        │              `apps/web/app/auth/verify/page.tsx` which shows
        │              "Open My Language Coach on your phone" + store buttons
        │
        ▼
verify.tsx calls supabase.auth.exchangeCodeForSession(url)
        │
        ├─ session returned → router.replace("/") → user is in the app
        │
        └─ error → show "Couldn't sign in" alert, redirect to sign-in screen
```

The `verify.tsx` screen already exists and handles both PKCE-style and fragment-style token formats. No mobile-app code changes beyond declaring the deep-link association in `app.config.ts`.

### Files added / modified

**`apps/web/app/.well-known/apple-app-site-association/route.ts`** (new — App Router Route Handler)

Returns:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "428X7TF9S6.com.brunomoise.mylanguagecoach",
        "paths": ["/auth/*"]
      }
    ]
  }
}
```

Critical: `Content-Type: application/json` and **no file extension** in the URL path (`.well-known/apple-app-site-association`, not `.json`). iOS is strict about both. Using a Next.js Route Handler at `apple-app-site-association/route.ts` produces the correct extensionless URL.

**`apps/web/app/.well-known/assetlinks.json/route.ts`** (new — App Router Route Handler)

Returns:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.anonymous.mylanguagecoach",
      "sha256_cert_fingerprints": ["<PRODUCTION_SHA256_FINGERPRINT>"]
    }
  }
]
```

The SHA-256 fingerprint comes from the production Android signing key. We'll extract it via `eas credentials` for the `com.anonymous.mylanguagecoach` package's production keystore. If the wrong fingerprint is used, Android's automatic App Links verification fails and the OS shows the "open with…" picker instead of going directly to the app.

**`apps/web/app/auth/verify/page.tsx`** (new — fallback page)

Renders only when the OS didn't intercept the link (desktop browser, app not installed, or App Links verification still pending). Shows a clear "Email confirmed!" message, Play Store + App Store buttons, and a soft "if you're on your phone, open the app" hint. Includes `<meta http-equiv="refresh" content="0; url=mylanguagecoach://verify?...">` as a last-ditch fallback to attempt the custom-scheme deep link from the rendered page — costs nothing, helps users on edge-case OS configurations.

**`apps/web/app/auth/verify/layout.tsx`** (new — minimal layout)

Strips the marketing-site nav and footer. Just the verify page on a clean background.

**`apps/web/lib/well-known.ts`** (new — pure functions)

Two pure exports: `buildAppleAppSiteAssociation(appId)` and `buildAssetLinks(packageName, sha256)`. Returns the JSON objects shown above. The Route Handlers call these and serialize. Keeping the JSON construction out of the route handler makes it cleanly unit-testable (vitest is configured to only collect `lib/**/*.test.ts`).

**`apps/web/lib/well-known.test.ts`** (new — Vitest)

Tests the pure builders' output against a Zod schema (correct shape, expected `appID` / `package_name` values, paths array contains `/auth/*`). The Route Handlers themselves are thin enough that we skip integration tests for them tonight — a fast post-deploy `curl` covers the wire-level checks.

**`apps/mobile/app.config.ts`** (modified)

Add to `ios`:

```typescript
associatedDomains: ["applinks:www.mylanguagecoach.app"],
```

Add to `android`:

```typescript
intentFilters: [
  {
    action: "VIEW",
    autoVerify: true,
    data: [
      {
        scheme: "https",
        host: "www.mylanguagecoach.app",
        pathPrefix: "/auth/",
      },
    ],
    category: ["BROWSABLE", "DEFAULT"],
  },
],
```

Bump `version`/build numbers: `android.versionCode: 41 → 42`, `ios.buildNumber: "7" → "8"`. The `version: "2.0.0"` user-facing string stays the same.

### Supabase configuration (no code; dashboard only)

- **Authentication → URL Configuration → Site URL:** set to `https://www.mylanguagecoach.app` (previously was probably blank or pointed elsewhere)
- **Authentication → URL Configuration → Redirect URLs:** add `https://www.mylanguagecoach.app/auth/verify` (keep existing `mylanguagecoach://verify` as fallback)

## Verification plan

After deploy + EAS submit:

1. `curl -i https://www.mylanguagecoach.app/.well-known/apple-app-site-association` → expect 200, `application/json`, valid JSON shape.
2. `curl -i https://www.mylanguagecoach.app/.well-known/assetlinks.json` → same.
3. **Apple AASA validator** (Apple-hosted): visit `https://app-site-association.cdn-apple.com/a/v1/www.mylanguagecoach.app` from a browser, expect Apple to have cached our JSON.
4. **Google Digital Asset Links tester**: paste `https://www.mylanguagecoach.app` and `com.anonymous.mylanguagecoach` into Google's tester; expect green check.
5. Install the new AAB on a real Android device. Sign up with a fresh email. Receive email. Tap link. **Expected:** the app opens directly on `verify.tsx`, the URL is delivered with all query params, `exchangeCodeForSession` succeeds, user lands on `/`.
6. Same flow on Bruno's friend's iPad with the new TestFlight build.
7. **Negative test:** sign up from a browser on desktop. Email arrives. Click link. Browser opens, lands on `/auth/verify` fallback page with "Open on your phone" message.
8. **MDM test:** retry the original failure scenario (work email → managed Gmail). Even if the OS can't open the app directly (corporate policy may still block app launches from managed apps), the user lands on the web fallback rather than getting "no application available" — a strictly better outcome.

## Risks & unknowns

- **App Links auto-verification on Android can take 24–48h** for Google's automated verifier to confirm the assetlinks.json match. For immediate testing on a development build, manual verification works via `adb shell pm verify-app-links --re-verify com.anonymous.mylanguagecoach` after install. Once verification completes, links open directly; until then, the OS shows a chooser.
- **Production signing fingerprint extraction**: must come from the EAS-managed production keystore via `eas credentials`. Using the debug keystore's fingerprint would let dev-built APKs open the app but production AABs would fall back to the chooser. We extract the right one before writing the assetlinks.json route.
- **Vercel deploys auto-trigger on push** for `apps/web` — so the moment we push the changes, the AASA and assetlinks endpoints go live publicly. That's safe (they're public files by design) but worth flagging.
- **iOS doesn't auto-re-fetch AASA**. If we publish wrong content first and fix it, devices that already cached the bad file stay broken until next app install or `swcutil reset` (developer-only). Mitigation: get the AASA content right the first time before announcing to testers.
- **The existing `apps/mobile/app/(auth)/verify.tsx` is fine for tonight** but the underlying `Linking.getInitialURL()` / `addEventListener("url", …)` flow showed "No initial URL — waiting for incoming link…" in Bruno's last failed test. We believe that was because the URL was custom-scheme + token already consumed, not a code bug. The Universal Links migration may surface no additional issue, but if `verify.tsx` doesn't receive the URL after the OS opens the app, that's a separate (smaller) follow-up.

## Rollout sequencing

1. Land web changes (AASA + assetlinks + verify page + tests) and deploy `apps/web` to production.
2. **Verify endpoints from outside before touching the app**: curl them, paste into Apple/Google validators, confirm green.
3. Update `apps/mobile/app.config.ts`, build + submit for both platforms.
4. Update Supabase Dashboard (Site URL + Redirect URLs).
5. Test end-to-end on a real device with a real new email.
6. *(After confirmation)* run the fraudulent-account cleanup DB delete.

Steps 1-2 are reversible and have zero blast radius on existing users (the email links Supabase generates today still point to `mylanguagecoach://verify` until step 4). Step 4 is the cutover moment — once that's done, all newly-sent confirmation emails use the new URL pattern. Existing already-sent emails with the old URL keep working because `mylanguagecoach://verify` stays in the allowlist.
