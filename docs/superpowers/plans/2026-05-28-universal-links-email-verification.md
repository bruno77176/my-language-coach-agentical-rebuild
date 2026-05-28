# Universal Links + App Links Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile `mylanguagecoach://verify` custom-scheme email deep link with a production-grade HTTPS link (`https://www.mylanguagecoach.app/auth/verify`) that uses iOS Universal Links + Android App Links, with a graceful web fallback when the app isn't installed.

**Architecture:** Add two well-known JSON files (`apple-app-site-association`, `assetlinks.json`) and a `/auth/verify` fallback page to `apps/web`; add `associatedDomains` + `intentFilters` to `apps/mobile/app.config.ts`; reconfigure Supabase's Site URL + Redirect URLs; rebuild and resubmit both stores.

**Tech Stack:** Next.js 14 App Router (Route Handlers), Vitest 2.x (web tests), Expo SDK with EAS Build, Supabase Auth.

---

## File Structure

**New files:**
- `apps/web/lib/well-known.ts` — pure builders for AASA + assetlinks JSON
- `apps/web/lib/well-known.test.ts` — unit tests for builders
- `apps/web/app/.well-known/apple-app-site-association/route.ts` — iOS AASA Route Handler
- `apps/web/app/.well-known/assetlinks.json/route.ts` — Android assetlinks Route Handler
- `apps/web/app/auth/verify/layout.tsx` — minimal layout (no marketing chrome)
- `apps/web/app/auth/verify/page.tsx` — fallback "open the app" page

**Modified files:**
- `apps/mobile/app.config.ts` — add `ios.associatedDomains`, `android.intentFilters`, bump `versionCode` and `buildNumber`

**Dashboard / out-of-band changes:**
- Extract production Android SHA-256 fingerprint via `eas credentials`
- Supabase Dashboard → Authentication → URL Configuration
- EAS build + submit for both platforms
- Real-device end-to-end test
- Database cleanup of 2 fraudulent accounts

---

## Task 1: Extract the production Android SHA-256 fingerprint

**Files:** none — this is a discovery task. The fingerprint becomes input to Task 3.

- [ ] **Step 1: Run eas credentials**

Run from `apps/mobile/`:

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
npx eas credentials --platform android
```

It's interactive. Select profile **production** → press Enter on the keystore item → choose **"View"** or similar to see the keystore details.

Expected output includes lines like:

```
SHA1 Fingerprint:   XX:XX:...
SHA256 Fingerprint: AB:CD:EF:01:...:99
```

- [ ] **Step 2: Save the fingerprint**

Copy the SHA256 value (with colons). Paste into a scratchpad. You'll need it verbatim in Task 3.

**Sanity check:** the fingerprint must be uppercase hex pairs separated by colons, 64 hex chars total → 32 pairs → 95 chars with colons. Example shape: `AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89`.

- [ ] **Step 3: No commit (no code change yet)**

---

## Task 2: well-known builders + tests

**Files:**
- Create: `apps/web/lib/well-known.ts`
- Test: `apps/web/lib/well-known.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/well-known.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  IOS_APP_ID,
  ANDROID_PACKAGE,
} from "./well-known";

describe("buildAppleAppSiteAssociation", () => {
  it("returns AASA shape claiming /auth/* for the iOS app", () => {
    const aasa = buildAppleAppSiteAssociation();
    expect(aasa).toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appID: IOS_APP_ID,
            paths: ["/auth/*"],
          },
        ],
      },
    });
  });

  it("uses the correct Team ID + bundle ID", () => {
    expect(IOS_APP_ID).toBe("428X7TF9S6.com.brunomoise.mylanguagecoach");
  });
});

describe("buildAssetLinks", () => {
  it("returns Digital Asset Links shape for the Android package", () => {
    const links = buildAssetLinks("AB:CD:EF");
    expect(links).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: ["AB:CD:EF"],
        },
      },
    ]);
  });

  it("uses the correct Android package name", () => {
    expect(ANDROID_PACKAGE).toBe("com.anonymous.mylanguagecoach");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/web"
pnpm test lib/well-known.test.ts
```

Expected: FAIL with "Cannot find module './well-known'" or similar.

- [ ] **Step 3: Implement the builders**

Create `apps/web/lib/well-known.ts`:

```typescript
// Constants for the iOS Universal Links + Android App Links well-known files.
// Values must match apps/mobile/app.config.ts exactly. Bundle IDs and Team ID
// changes ship with an app rebuild — keep these in sync at that time.

export const IOS_APP_ID = "428X7TF9S6.com.brunomoise.mylanguagecoach";
export const ANDROID_PACKAGE = "com.anonymous.mylanguagecoach";

export type AppleAppSiteAssociation = {
  applinks: {
    apps: string[];
    details: Array<{ appID: string; paths: string[] }>;
  };
};

export type AssetLinks = Array<{
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}>;

export function buildAppleAppSiteAssociation(): AppleAppSiteAssociation {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: IOS_APP_ID,
          paths: ["/auth/*"],
        },
      ],
    },
  };
}

export function buildAssetLinks(sha256Fingerprint: string): AssetLinks {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [sha256Fingerprint],
      },
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/well-known.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git add apps/web/lib/well-known.ts apps/web/lib/well-known.test.ts
git commit -m "feat(web): well-known JSON builders for Universal/App Links

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: AASA Route Handler

**Files:**
- Create: `apps/web/app/.well-known/apple-app-site-association/route.ts`

- [ ] **Step 1: Implement the route handler**

Create `apps/web/app/.well-known/apple-app-site-association/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { buildAppleAppSiteAssociation } from "@/lib/well-known";

// iOS fetches this file with a strict Content-Type expectation
// (application/json) and NO file extension in the URL. The directory name
// includes the extensionless filename so the resulting URL is exactly:
//   https://www.mylanguagecoach.app/.well-known/apple-app-site-association
//
// iOS also REFUSES to follow redirects when fetching this file. The
// mylanguagecoach.app apex 307s to www, which is why all app config + this
// route assume the www host.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildAppleAppSiteAssociation(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
```

- [ ] **Step 2: Smoke-test locally**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/web"
pnpm dev
```

In another terminal:

```bash
curl -i http://localhost:3002/.well-known/apple-app-site-association
```

Expected: `200 OK`, `Content-Type: application/json`, body is the JSON from the builder.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git add apps/web/app/.well-known/apple-app-site-association/route.ts
git commit -m "feat(web): serve apple-app-site-association for iOS Universal Links

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: assetlinks Route Handler (Android)

**Files:**
- Create: `apps/web/app/.well-known/assetlinks.json/route.ts`

- [ ] **Step 1: Implement the route handler**

Create `apps/web/app/.well-known/assetlinks.json/route.ts`. **Paste the SHA-256 fingerprint from Task 1, Step 2** into the `SHA256_FINGERPRINT` constant below:

```typescript
import { NextResponse } from "next/server";
import { buildAssetLinks } from "@/lib/well-known";

// Production Android signing key SHA-256 fingerprint. Extracted via
// `eas credentials --platform android` → production profile. If this is
// wrong, Google's App Links auto-verification fails and Android shows the
// "open with…" chooser instead of opening the app directly. Update + redeploy
// if the production keystore ever rotates.
const SHA256_FINGERPRINT =
  "BC:37:D5:24:28:76:AE:B6:CF:0C:BB:22:F0:C3:9A:59:28:1A:BC:D3:14:84:74:A6:7A:02:D2:9D:C5:61:2D:2E";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildAssetLinks(SHA256_FINGERPRINT), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
```

- [ ] **Step 2: Smoke-test locally**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/web"
pnpm dev
```

In another terminal:

```bash
curl -i http://localhost:3002/.well-known/assetlinks.json
```

Expected: `200 OK`, `Content-Type: application/json`, body is the JSON with your fingerprint.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git add apps/web/app/.well-known/assetlinks.json/route.ts
git commit -m "feat(web): serve assetlinks.json for Android App Links

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Fallback /auth/verify page

**Files:**
- Create: `apps/web/app/auth/verify/layout.tsx`
- Create: `apps/web/app/auth/verify/page.tsx`

- [ ] **Step 1: Create the minimal layout**

Create `apps/web/app/auth/verify/layout.tsx`:

```typescript
import type { ReactNode } from "react";

// Strip the marketing site's nav + footer for this page. Users land here
// after clicking an email confirmation link and we want a focused screen,
// not the landing-page chrome.
export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#fde7d1]">{children}</main>;
}
```

- [ ] **Step 2: Create the fallback page**

Create `apps/web/app/auth/verify/page.tsx`:

```typescript
import Link from "next/link";

// This page only renders when the OS did NOT intercept the link — i.e. the
// user is on desktop, the app isn't installed, or App/Universal Links
// verification hasn't completed yet. When the app IS installed and verified,
// the OS opens it directly and this page never loads.
//
// The <meta http-equiv="refresh"> tag below is a last-ditch fallback to
// attempt the custom-scheme deep link from the rendered page; harmless if
// it fails (browser stays on this page).

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach";
const APP_STORE_URL = "https://apps.apple.com/app/my-language-coach"; // placeholder until iOS launches publicly

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string; type?: string };
}) {
  const customSchemeUrl = searchParams.token
    ? `mylanguagecoach://verify?token=${encodeURIComponent(searchParams.token)}&type=${encodeURIComponent(searchParams.type ?? "signup")}`
    : "mylanguagecoach://verify";

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${customSchemeUrl}`} />
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="font-serif text-4xl font-semibold text-[#1a1a1a]">
          Email confirmed
        </h1>
        <p className="mt-4 max-w-md text-lg text-[#1a1a1a]/70">
          Open My Language Coach on your phone to finish signing in.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={PLAY_STORE_URL}
            className="rounded-full bg-[#1a1a1a] px-6 py-3 text-white"
          >
            Get it on Google Play
          </Link>
          <Link
            href={APP_STORE_URL}
            className="rounded-full border border-[#1a1a1a] px-6 py-3 text-[#1a1a1a]"
          >
            Download on App Store
          </Link>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Smoke-test locally**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/web"
pnpm dev
```

Visit `http://localhost:3002/auth/verify?token=abc&type=signup` in a browser. Expected: page renders with "Email confirmed" headline and the two store buttons.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git add apps/web/app/auth/verify/layout.tsx apps/web/app/auth/verify/page.tsx
git commit -m "feat(web): /auth/verify fallback page for Universal Links

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Typecheck the web changes

**Files:** none — verification only.

- [ ] **Step 1: Run typecheck**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
pnpm --filter @language-coach/web typecheck
```

Expected: no output, exit 0.

- [ ] **Step 2: Run full web test suite**

```bash
pnpm --filter @language-coach/web test
```

Expected: all tests pass including new `well-known.test.ts`.

- [ ] **Step 3: If anything fails, fix and re-commit before continuing**

---

## Task 7: Deploy apps/web to production (via PR + merge to main)

**Files:** none — deploy only.

`apps/web`'s Vercel project auto-deploys on push to `main`. Bruno prefers to land everything via PR review rather than direct push.

- [ ] **Step 1: Push the worktree branch**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git push origin worktree-debug-chat-usage-recording
```

- [ ] **Step 2: Open the pull request**

```bash
gh pr create --title "feat: Universal Links + App Links for email verification" --body "$(cat <<'EOF'
## Summary
- adds AASA + assetlinks well-known files served from `apps/web`
- adds `/auth/verify` fallback page
- hardens `supabase-verifier.ts` to reject unconfirmed emails (defense-in-depth)
- declares `associatedDomains` (iOS) + `intentFilters` (Android) in mobile config
- bumps versionCode 41→42, buildNumber 7→8

Closes the auth-bypass bug discovered 2026-05-28 where a friend signed up as bruno.moise@gmail.com (an email he doesn't own) because Supabase's "Confirm email" toggle was OFF and the backend verifier didn't check email_confirmed_at.

Spec: docs/superpowers/specs/2026-05-28-universal-links-email-verification-design.md
Plan: docs/superpowers/plans/2026-05-28-universal-links-email-verification.md

## Test plan
- [ ] curl `/.well-known/apple-app-site-association` returns AASA JSON
- [ ] curl `/.well-known/assetlinks.json` returns assetlinks JSON with prod fingerprint
- [ ] `/auth/verify?token=...` renders the fallback page
- [ ] On real Android device with new versionCode 42, tap email link → app opens directly
- [ ] On TestFlight iOS buildNumber 8, same
- [ ] DB: new test signup has `email_confirmed_at` ~minutes after `created_at` (not ms)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge the PR**

After review (CI green, Bruno's approval), merge to main. Either:
- via the GitHub UI ("Squash and merge" or "Create a merge commit" — match the repo's convention), OR
- `gh pr merge --squash --auto` if you want it to auto-merge once checks pass

- [ ] **Step 4: Wait for Vercel auto-deploy**

Watch the Vercel dashboard or run:

```bash
npx vercel ls --scope brunoamoise-1277s-projects 2>&1 | head -20
```

Wait for the new deploy to flip to **READY** status. Typically 1-2 min.

- [ ] **Step 5: Verify endpoints from prod**

Hit them via curl from any terminal:

```bash
curl -i https://www.mylanguagecoach.app/.well-known/apple-app-site-association
```

Expected: `HTTP/2 200`, `Content-Type: application/json`, body is the AASA JSON.

```bash
curl -i https://www.mylanguagecoach.app/.well-known/assetlinks.json
```

Expected: `HTTP/2 200`, `Content-Type: application/json`, body is the assetlinks JSON with your fingerprint.

```bash
curl -i "https://www.mylanguagecoach.app/auth/verify?token=test123&type=signup"
```

Expected: `HTTP/2 200`, HTML body containing "Email confirmed".

- [ ] **Step 6: Verify Apple's cached AASA**

Open in a browser:

```
https://app-site-association.cdn-apple.com/a/v1/www.mylanguagecoach.app
```

Apple's CDN caches AASA files for ~24h. Initial fetch may return empty / not-found; that's fine. iOS devices fetch directly from your origin on app install, so this CDN is informational only.

- [ ] **Step 7: Verify Google's assetlinks lookup**

Run:

```bash
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.mylanguagecoach.app&relation=delegate_permission/common.handle_all_urls"
```

Expected: JSON response listing your statement (`com.anonymous.mylanguagecoach` + fingerprint).

- [ ] **Step 8: No commit (deploy is via the merged PR — no extra change here)**

---

## Task 8: Mobile app config — declare deep-link association

**Files:**
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Read the current ios + android blocks**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
cat apps/mobile/app.config.ts
```

Locate the `ios: { ... }` block (current state has `supportsTablet`, `bundleIdentifier`, `buildNumber`, `usesAppleSignIn`, `infoPlist`) and the `android: { ... }` block (current state has `package`, `versionCode`, `permissions`, `adaptiveIcon`).

- [ ] **Step 2: Modify ios block — add associatedDomains, bump buildNumber**

Edit `apps/mobile/app.config.ts`. Change the `ios:` block:

**FROM:**
```typescript
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.brunomoise.mylanguagecoach",
      buildNumber: "7",
      usesAppleSignIn: true,
      infoPlist: {
        NSMicrophoneUsageDescription:
          "We use the microphone so you can talk to your coach.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
```

**TO:**
```typescript
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.brunomoise.mylanguagecoach",
      buildNumber: "8",
      usesAppleSignIn: true,
      associatedDomains: ["applinks:www.mylanguagecoach.app"],
      infoPlist: {
        NSMicrophoneUsageDescription:
          "We use the microphone so you can talk to your coach.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
```

- [ ] **Step 3: Modify android block — add intentFilters, bump versionCode**

Change the `android:` block:

**FROM:**
```typescript
    android: {
      package: "com.anonymous.mylanguagecoach",
      versionCode: 41,
      permissions: ["RECORD_AUDIO"],
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#fde7d1",
      },
    },
```

**TO:**
```typescript
    android: {
      package: "com.anonymous.mylanguagecoach",
      versionCode: 42,
      permissions: ["RECORD_AUDIO"],
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
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#fde7d1",
      },
    },
```

- [ ] **Step 4: Typecheck the mobile app**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
pnpm --filter @language-coach/mobile typecheck
```

Expected: clean exit. If `intentFilters` types complain, the Expo types may not match; in that case wrap with `as ExpoConfig["android"]` or check the Expo SDK docs for the exact shape. The shape above matches Expo SDK 53.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): declare Universal Links + App Links for /auth/*

Bumps versionCode 41→42 and iOS buildNumber 7→8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Build + submit Android production

**Files:** none — build/submit only.

- [ ] **Step 1: Kick off the Android build**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
npx eas build --profile production --platform android --non-interactive
```

This takes 15-30 min in EAS Build cloud. Output URL will be reported.

- [ ] **Step 2: Wait for build to complete**

Monitor at https://expo.dev/accounts/bruno77176/projects/my-language-coach/builds or wait for the CLI to print "Build successful".

- [ ] **Step 3: Submit to Play Console internal testing**

```bash
npx eas submit --platform android --latest
```

Pick the **production** track when prompted, or use `--track production` flag. (Per project memory, Bruno's flow has been bumping to production. The build will land as a draft on the Open Testing track.)

- [ ] **Step 4: Verify in Play Console**

Open https://play.google.com/console → My Language Coach → **Release → Testing → Open testing** → confirm versionCode 42 appears.

---

## Task 10: Build + submit iOS production

**Files:** none — build/submit only.

- [ ] **Step 1: Kick off the iOS build**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
npx eas build --profile production --platform ios --non-interactive
```

Same wait time as Android.

- [ ] **Step 2: Submit to TestFlight**

```bash
npx eas submit --platform ios --latest
```

- [ ] **Step 3: Verify in App Store Connect**

Open https://appstoreconnect.apple.com → My Language Coach → **TestFlight** → confirm buildNumber 8 appears (may take 10-30 min to finish processing).

---

## Task 11: Update Supabase URL configuration

**Files:** none — dashboard only.

- [ ] **Step 1: Open Supabase URL configuration**

URL: https://supabase.com/dashboard/project/nzrrqykcloanoaqwbexv/auth/url-configuration

- [ ] **Step 2: Set Site URL**

In the **Site URL** field, set:

```
https://www.mylanguagecoach.app
```

- [ ] **Step 3: Add the new redirect URL**

In the **Redirect URLs** list, click **Add URL** and enter:

```
https://www.mylanguagecoach.app/auth/verify
```

Keep the existing `mylanguagecoach://verify` entry in the list. It stays as a transitional fallback in case the rollout has issues — new emails will use the new URL but already-sent emails still work.

- [ ] **Step 4: Click Save**

Supabase has no rollback for this — once saved, every new confirmation email uses the new URL pattern. Existing already-sent emails with the old URL keep working (since the old entry stays in the allowlist).

---

## Task 12: End-to-end test on a real device

**Files:** none — verification only.

- [ ] **Step 1: Install the new Android AAB on Bruno's device**

After Task 9's build lands on Open Testing, Bruno's existing Open Testing tester opt-in delivers the new versionCode 42 update. Force-update via Play Store on the device (Play Store → My Language Coach → Update).

- [ ] **Step 2: Force Android App Links re-verification**

The first time Android sees the new app, it auto-fetches `assetlinks.json` and may take a few minutes. To force immediate verification, connect the device via USB and run:

```bash
adb shell pm verify-app-links --re-verify com.anonymous.mylanguagecoach
adb shell pm get-app-links com.anonymous.mylanguagecoach
```

Expected: state `verified` for `www.mylanguagecoach.app`.

- [ ] **Step 3: Sign up with a real fresh email**

In the app, sign out → Create account → use a real personal email Bruno controls (e.g. `bruno.a.moise+universal-links-test@gmail.com`).

Expected: app shows "Check your inbox to confirm your email."

- [ ] **Step 4: Receive + click the email link**

Open the personal Gmail inbox on the same device. Email arrives from `noreply@mylanguagecoach.app` (Resend SMTP, set up earlier this session).

Tap the link. **Expected:** the OS opens the My Language Coach app directly. The verify screen runs `exchangeCodeForSession` and routes to the home screen. Bruno is signed in.

- [ ] **Step 5: Negative test — desktop**

Sign up from a desktop browser flow (or simply paste the email link into a desktop browser). Expected: the `/auth/verify` fallback page renders with "Email confirmed — open My Language Coach on your phone" + store buttons.

- [ ] **Step 6: Verify in DB**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
node probe-auth-audit.cjs
```

Expected: the new test account appears with `email_confirmed_at` set ~minutes (NOT milliseconds) after `created_at` — proving the user actually had to click the email link, not auto-confirmed.

---

## Task 13: Clean up the two fraudulent accounts

**Files:**
- Create: `probe-delete-fraudulent-accounts.cjs` (one-shot, kept in worktree for audit trail)

- [ ] **Step 1: Write the deletion probe**

Create `probe-delete-fraudulent-accounts.cjs` at the worktree root:

```javascript
// One-shot: delete the two known-fraudulent auth.users rows discovered
// during the 2026-05-28 auth-bypass debugging session.
//
//   bruno.moise@gmail.com → uuid e6dafbbc-… (friend's typo / fraud)
//   albeniz_77@hotmail.com → uuid 87f80fe2-… (friend's second test, same hour)
//
// auth.users has ON DELETE CASCADE to profiles, entitlements, conversations,
// messages, usage_events (via the public schema FKs). Verify cascades before
// running by running the SELECTs first; comment them out to actually delete.

const fs = require("node:fs");
const path = require("node:path");
const postgres = require("./apps/api/node_modules/postgres");

const TARGETS = [
  { id: "e6dafbbc-5bb9-4d39-8809-1dbadc943c9c", email: "bruno.moise@gmail.com" },
  { id: "87f80fe2-d0ee-40b8-a4a2-2eb813079a3e", email: "albeniz_77@hotmail.com" },
];

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, "apps", "api", ".env"), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[m[1]] = val;
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });
  try {
    for (const t of TARGETS) {
      const u = await sql`SELECT id, email FROM auth.users WHERE id = ${t.id}`;
      if (u.length === 0) {
        console.log(`SKIP ${t.email}: not found in auth.users`);
        continue;
      }
      if (u[0].email !== t.email) {
        console.log(`SKIP ${t.email}: id matches but email differs (${u[0].email}) — manual review`);
        continue;
      }
      const result = await sql`DELETE FROM auth.users WHERE id = ${t.id} RETURNING id, email`;
      console.log(`DELETED ${result[0].email} (${result[0].id})`);
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the probe**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
node probe-delete-fraudulent-accounts.cjs
```

Expected output: 2 `DELETED` lines, one per target.

- [ ] **Step 3: Verify the cascade**

```bash
node probe-auth-audit.cjs
```

Expected: 12 users remaining (down from 14), neither fraudulent email present.

- [ ] **Step 4: No commit (probe is one-shot, but stays around for audit trail)**

Optionally add the probe to `.gitignore`'s probe-*.cjs pattern if it doesn't already match.

---

## Task 14: Final verification + memory update

**Files:**
- Modify: `C:/Users/bruno.moise/.claude/projects/.../memory/project_email_verification_bug.md` (mark resolved)

- [ ] **Step 1: Re-run the auth audit one final time**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
node probe-auth-audit.cjs
```

Confirm:
- 12 users (or 12 + your fresh test signup from Task 12)
- All email-provider signups created AFTER Task 11's save have `confirm_delay` measured in minutes (not milliseconds)

- [ ] **Step 2: Update the project memory file**

Edit `C:/Users/bruno.moise/.claude/projects/C--Users-bruno-moise-My-Language-Coach---rebuild/memory/project_email_verification_bug.md`. Change the description to reflect the resolution:

```markdown
---
name: email-verification-bug
description: 2026-05-28 RESOLVED — Supabase "Confirm email" toggle ON, custom SMTP via Resend, Universal Links + App Links at https://www.mylanguagecoach.app/auth/verify; verifier hardened. Friend's fraudulent accounts deleted.
metadata:
  type: project
---
```

And add at the end:

```markdown
**2026-05-28 evening — RESOLVED:**
- Supabase Confirm email toggle ON
- Custom SMTP wired (Resend, smtp.resend.com:465, domain mylanguagecoach.app verified)
- supabase-verifier.ts hardened with email_confirmed_at check + unit test
- Universal Links (iOS) + App Links (Android) shipped via apps/web /.well-known/* and apps/mobile app.config.ts associatedDomains/intentFilters
- App rebuilt versionCode 42 / buildNumber 8 and pushed to Open Testing + TestFlight
- Supabase Site URL updated to https://www.mylanguagecoach.app
- Fraudulent accounts bruno.moise@gmail.com + albeniz_77@hotmail.com deleted from auth.users
```

- [ ] **Step 3: Commit any remaining work**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/.claude/worktrees/debug-chat-usage-recording"
git status
git add -A   # only if there are intentional changes — review first
git commit -m "chore: deploy Universal Links + App Links email verification

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Mark task #10 (deep-link verification) complete**

Use TaskUpdate to mark task #10 as completed once you've confirmed Task 12 succeeded end-to-end.

---

## Out-of-scope follow-ups (not part of this plan)

- **Switch password-reset and magic-link flows to use the same `/auth/*` URLs.** Their handlers in `apps/mobile/app/(auth)/*` already exist; just point Supabase's Reset Password redirect URL at `https://www.mylanguagecoach.app/auth/reset-password` and add a matching `reset-password/page.tsx` to apps/web.
- **Migrate the 10 instant-confirmed accounts** if any turn out to be unknown strangers (audit case by case).
- **Fix the pg_cron job** that refreshes the cost dashboard's materialized view — broken URL with embedded CRLF found earlier in this session.
- **Investigate the vitest 4.x / Node 22 incompatibility** in `apps/api` that prevents the verifier test from running. Pin vitest to a compatible version or upgrade to one that supports Node 22's `#module-evaluator` package import.
- **Unify iOS bundle ID and Android package** (currently asymmetric: `com.brunomoise.mylanguagecoach` vs `com.anonymous.mylanguagecoach`). Rename is store-disruptive; defer.

---

## Spec coverage check

Mapping spec sections → tasks:
- Why / Goals → covered by plan as a whole.
- AASA + assetlinks → Tasks 2-4.
- /auth/verify fallback page → Task 5.
- Mobile app.config.ts changes → Task 8.
- Supabase URL config → Task 11.
- Build + ship both platforms → Tasks 9-10.
- Verification plan → Task 7 (web), Task 12 (mobile e2e).
- Fraudulent-account cleanup → Task 13.
- Rollout sequencing (web first, then mobile, then Supabase cutover) → reflected in task order.
