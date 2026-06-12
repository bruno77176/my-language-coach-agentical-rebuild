# iOS RevenueCat / In-App Purchases — setup runbook

**Goal:** bring iOS to parity with the live Android billing (done 2026-06-11). When this
runbook is complete, an iOS user can buy Pro (monthly/annual) via the App Store, RC unlocks
the `pro` entitlement, and the Fly webhook maps it back to their Supabase account — exactly
like Android.

The **mobile code is already wired** (commit on `main`, 2026-06-12): `_layout.tsx` now picks
the RC key by platform and configures + `logIn`s on iOS, and `app.config.ts` exposes
`EXPO_PUBLIC_REVENUECAT_IOS_KEY`. What's left is all dashboard/store config plus one EAS env
var and a build. Steps below are ordered by dependency — **do them top to bottom**.

## Constants you'll reuse

| Thing              | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| iOS bundle ID      | `com.brunomoise.mylanguagecoach`                                       |
| Apple Team ID      | `428X7TF9S6`                                                           |
| Apple ID           | `bruno.a.moise@gmail.com`                                              |
| ASC App ID         | `6746396786`                                                           |
| Entitlement (RC)   | `pro`                                                                  |
| Offering (RC)      | `default` → packages `$rc_monthly`, `$rc_annual`                       |
| Product IDs (iOS)  | `mlc_pro_monthly`, `mlc_pro_annual`                                    |
| EAS env var to set | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (value: the `appl_…` key from Step 3) |

> **Product-ID note:** Apple product IDs are flat (no `:basePlan` suffix like Android's
> `mlc_pro_monthly:monthly`). Use plain `mlc_pro_monthly` / `mlc_pro_annual`. RevenueCat maps
> both the Apple and Google products onto the **same** `$rc_monthly` / `$rc_annual` packages in
> the `default` offering, so the app code needs no per-store branching beyond the SDK key.

---

## Step 1 — App Store Connect: Paid Apps Agreement (the long pole — do this first)

Sandbox/TestFlight purchase testing needs the **Paid Applications Agreement** active, and it
requires banking + tax info that can take time to clear. Start it before anything else.

1. App Store Connect → **Business** (Agreements, Tax, and Banking).
2. Under **Paid Apps**, click into the agreement → **Review & Accept**.
3. Add a **Bank Account** (Manage Banking) and **Tax forms** (US W-8/W-9 + any local).
4. Wait until the Paid Apps agreement status shows **Active**. Subscriptions can be _created_
   while it's pending, but won't be **purchasable** (even in sandbox) until it's active.

---

## Step 2 — App Store Connect: create the two subscriptions

App Store Connect → **Apps** → My Language Coach → **Monetization → Subscriptions**.

1. **Create a Subscription Group** — e.g. `Pro` (display name shown to users: "My Language
   Coach Pro"). Both products live in this one group so they're mutually exclusive (a user
   upgrades/downgrades between monthly and annual rather than stacking).
2. **Add subscription** → Reference Name `Pro Monthly`, **Product ID `mlc_pro_monthly`**,
   duration **1 month**.
3. **Add subscription** → Reference Name `Pro Annual`, **Product ID `mlc_pro_annual`**,
   duration **1 year**.
4. For **each** product fill the required metadata or it stays "Missing Metadata" and RC
   can't fetch it:
   - **Subscription price** (pick a tier per region — mirror the Play Store pricing).
   - **Localization**: at minimum the primary locale — display name + description.
   - **Review information**: a screenshot of the paywall and review notes (Apple needs this
     to approve the IAP; for sandbox testing the product just needs to be in **"Ready to
     Submit"**, it does not need to be live-approved).
5. Confirm both products show status **Ready to Submit** (or Approved). That's enough for
   sandbox.

---

## Step 3 — RevenueCat dashboard: add the App Store app + key

RevenueCat → your project (the same one that holds the Play Store app + `pro` entitlement +
`default` offering).

1. **Project settings → Apps → + New → App Store**.
   - App name: `My Language Coach (iOS)`
   - **Bundle ID: `com.brunomoise.mylanguagecoach`**
2. **In-App Purchase Key** (RC uses this for server-side receipt validation — the iOS
   equivalent of the Android service-account creds):
   - App Store Connect → **Users and Access → Integrations → In-App Purchase** → **+** to
     generate an **In-App Purchase Key**. Download the `.p8` (one-time download), note the
     **Key ID** and your **Issuer ID**.
   - Back in RevenueCat's App Store app config, upload the `.p8` and paste Key ID + Issuer ID.
   - Also paste the **App-Specific Shared Secret** if RC asks (ASC → app → App Information →
     Manage **App-Specific Shared Secret**). The In-App Purchase Key is the modern path and
     preferred; the shared secret is the legacy fallback.
3. **Copy the iOS public SDK key** — RC shows it as **`appl_…`** under the App Store app's
   API keys. **This is the value for `EXPO_PUBLIC_REVENUECAT_IOS_KEY`** (Step 5).

---

## Step 4 — RevenueCat: attach iOS products to the existing entitlement + offering

The `pro` entitlement and `default` offering already exist from the Android setup — you're
just adding the Apple products to them.

1. **Products** → import/add the two App Store products `mlc_pro_monthly`, `mlc_pro_annual`
   (RC can auto-import once the IAP key from Step 3 is valid and the products are Ready to
   Submit).
2. **Entitlements → `pro`** → attach both iOS products.
3. **Offerings → `default`**:
   - Package **`$rc_monthly`** → attach `mlc_pro_monthly` (App Store).
   - Package **`$rc_annual`** → attach `mlc_pro_annual` (App Store).
     These are the same packages the app reads as `offerings.monthly` / `offerings.annual`, so
     the existing paywall UI works unchanged.

---

## Step 5 — EAS: set the iOS SDK key env var

The real key lives in **EAS project env** (not committed to `eas.json`), exactly like the
Android `goog_…` key. Set it for all three environments so production, preview, and dev
builds all get it:

```sh
# from app/apps/mobile, using the appl_… value from Step 3
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_XXXXXXXX" --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_XXXXXXXX" --environment preview     --visibility plaintext
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_XXXXXXXX" --environment development --visibility plaintext
```

(Or set it in the EAS dashboard → project → Environment variables. `EXPO_PUBLIC_` keys are
not secret — `plaintext` visibility is correct, matching the Android key.)

Verify: `eas env:list --environment production` shows `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.

---

## Step 6 — Build + sandbox-test on TestFlight

1. **Sandbox tester**: ASC → **Users and Access → Sandbox → Testers** → add a test Apple ID
   (a fresh email not used as a real Apple ID). You'll sign in with it on-device when
   prompted by the purchase sheet — **not** in iOS Settings.
2. **Build** (version stays frozen at **2.0.2**, `buildNumber` already bumped to **43**):
   ```sh
   eas build -p ios --profile production
   ```
3. **Submit to TestFlight**:
   ```sh
   eas submit -p ios --latest
   ```
   (submit config already in `eas.json`: appleId / appleTeamId `428X7TF9S6` / ascAppId
   `6746396786`.)
4. Install via TestFlight, open the paywall, **buy** monthly or annual. When the App Store
   sheet asks to sign in, use the **sandbox tester** Apple ID.
5. **Verify**, mirroring the Android acceptance checks:
   - Pro unlocks in-app (entitlement `pro` active).
   - In RC dashboard the purchase appears (sandbox / €0 — **expected** for sandbox testers,
     not a bug, same as Android license testers).
   - RC `app_user_id` is aliased to the Supabase `user.id`.
   - The webhook hits `https://my-language-coach-agentical-rebuild.fly.dev/v1/billing/revenuecat`
     and returns 200 (the same endpoint + `REVENUECAT_WEBHOOK_SECRET` already serves Android —
     no change needed, RC sends both stores to the one webhook).

---

## Done = parity

When Step 6 passes, iOS billing is at Android parity. Remaining store-side polish (submitting
the IAPs for full App Review alongside the next app submission, production pricing review)
rides along with the normal release — sandbox unlock is the engineering acceptance gate.
