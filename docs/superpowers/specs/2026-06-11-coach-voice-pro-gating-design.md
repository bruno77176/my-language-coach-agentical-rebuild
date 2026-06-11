# Coach's voice becomes a Pro feature + working upgrade button

**Date:** 2026-06-11
**Status:** Approved design — ready for implementation plan
**Scope:** Project 1 of 2. (Project 2 = iOS RevenueCat parity, designed separately and after this ships.)

## Problem

RevenueCat billing is now live-wired on Android (entitlement `pro`, monthly/annual
packages, webhook → Fly). But nothing in the app is actually gated by `isPro`: the
`usePurchases` hook is only read inside the paywall itself. Two concrete gaps:

1. The **Coach's voice** screen (`voice-lab` — TTS provider/voice/speed/tone picker)
   is fully open to every user, so the just-shipped billing sells nothing tangible.
2. The profile **"Upgrade to Pro"** row is a dead end — it shows a "Coming soon"
   toast instead of opening the (fully built, working) paywall.

This project makes choosing the coach's voice a Pro feature, enforces it on the
server so it can't be bypassed, wires the upgrade button to the paywall, and
reflects the change in the paywall and marketing-site copy.

## Decisions (settled during brainstorming)

- **Gating model:** _Preview free, Save gated._ Free users open the voice screen and
  preview any voice/provider/speed/tone (the taste), but Save routes to the paywall.
  Live conversations use the default voice until they upgrade.
- **Server-side enforcement:** _Yes._ The voice turn pipeline forces the default
  voice for non-Pro users regardless of the config the client sends. Closes the API
  bypass and correctly downgrades pre-existing custom configs. Preview stays free.
- **Web locale scope:** _All 15 locales_ get the updated Pro feature copy.

## Design

### A. Mobile app (`apps/mobile`)

**Profile screen — `app/(tabs)/profile/index.tsx`**

- Replace the "Upgrade to Pro → Coming soon" toast row (currently ~line 230–237)
  with a real entry driven by `usePurchases().isPro`:
  - Free → label "Upgrade to Pro", value e.g. "Unlock everything", `onPress` →
    `router.push("/(modals)/paywall")`.
  - Pro → label "Pro", value "Active ✓ · Manage"; `onPress` opens the paywall
    (which carries Restore + the store-managed cancel fine-print). No separate
    manage screen is built in this project.
- The "Coach's voice" row keeps navigating to `voice-lab` (preview is free). For
  free users it shows a small **"Pro"** pill so the gating is legible before they tap.

**Voice Lab — `app/(tabs)/profile/voice-lab.tsx`**

- Read `isPro` from `usePurchases()`.
- **Preview** (`onPreview`) is unchanged — works for everyone (the free taste).
- **Save**:
  - Pro → saves to the `useVoiceLab` store as today.
  - Free → button renders "🔒 Save voice" and `onPress` routes to
    `/(modals)/paywall` instead of calling `setConfig`. A one-line banner
    ("Unlock to keep your voice — Pro") appears above the Save button for free users.

**Turn requests**

- The client only attaches `voice_config` to a turn when `isPro` is true
  (belt-and-suspenders; the server enforces regardless). Exact call site
  (`use-conversation` / `api-client`) to be confirmed during implementation.

**Paywall — `app/(modals)/paywall.tsx`**

- Add a bullet to `FEATURES_LIST`:
  "Choose your coach's voice — 15 native voices, speed & tone."

### B. Backend (`apps/api`)

**Turns route — `src/routes/voice.ts`**

- Around line 536, the route parses an optional `voice_config` from the form data and
  falls back to `DEFAULT_TTS_CONFIG` when absent. The route already computes a Pro
  check for `memoryDepth` (lines 443–445). Extract that into an `isPro` boolean and
  add: `if (!isPro) voiceConfig = undefined;` so non-Pro turns always use the default
  voice. ~2 lines, reusing the entitlement already loaded for quota.

**Live WS route — `src/routes/voice-live.ts`**

- Apply the same `isPro` → default-voice gate for parity. Secondary (the route is
  already gated by `VOICE_LIVE_USER_IDS`), but kept consistent with the turns route.

**Preview route**

- Unchanged. Preview is the free taste and must stay open to all users.

**Tests**

- Unit test in the existing voice-turn test file: a free entitlement forces the
  default voice even when a custom `voice_config` is supplied; a Pro entitlement
  honors the custom config.

### C. Web (`apps/web`)

- Add "Choose your coach's voice" to `pricing.pro.items` in all 15 locale JSON files
  under `apps/web/messages/`, translated per locale. The Free column is unchanged.
- `Pricing.tsx` needs no structural change — it already maps `messages.pro.items`.
- The existing voice showcase copy (en.json line ~51, "Choose your coach's voice,
  then set the speaking speed…") stays as-is; it markets the capability, which Pro
  delivers.

## Edge cases

- **Existing free user who customized while the screen was open** — server forces the
  default voice; client stops sending the config; Save is locked. Correct downgrade,
  no data migration needed.
- **Pro → churn** — the RevenueCat webhook flips the entitlement to `free`; the next
  turn uses the default voice and Save re-locks. Automatic.
- **iOS** — `isPro` is always false on iOS until Project 2 (RevenueCat is Android-only
  in `_layout.tsx` today), so the voice gate is simply always-on for iOS users.
  Nothing is sellable on iOS yet, so this is expected and harmless.

## Testing & rollout

- Backend: add the vitest case; run `pnpm format && pnpm lint && pnpm typecheck &&
pnpm test` from `app/` and keep CI green before pushing.
- Manual (Android internal-testing build with a license tester):
  - Free account: voice-lab preview works; Save → paywall; profile "Upgrade to Pro"
    → paywall.
  - Upgrade: Save works; a live conversation uses the chosen voice.
- Web: confirm the Pro column shows the voice bullet (EN + FR, spot-check 2–3 other
  locales).
- Version: mobile change ships as a build-number-only bump (marketing version frozen
  at 2.0.2 per policy).

## Out of scope

- iOS RevenueCat / App Store payments (Project 2).
- A dedicated subscription-management screen (the paywall's Restore + store-managed
  cancellation cover v1).
- Per-feature entitlement toggling (all Pro features remain all-or-nothing).
