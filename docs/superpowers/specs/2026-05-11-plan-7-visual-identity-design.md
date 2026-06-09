# Design — Plan 7: Visual identity polish + design system

**Date:** 2026-05-11
**Status:** Awaiting user review of this spec
**Author:** Bruno + Claude (brainstorming session)
**Parent spec:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`
**Predecessor plan:** `docs/superpowers/plans/2026-05-10-plan-6-voice-loop-parity.md` (DONE, on `main` HEAD `54eab3d`)
**Legacy reference:** `my-language-coach/` (Expo SDK 52 RN app — assets ported)
**Visual companion artifacts:** `.superpowers/brainstorm/852-1778479609/content/` (mockups: `full-mockup.html`, `palette.html`, `typography.html`, `avatar.html`, `avatar-rethink.html`, `icon-and-intro.html`)

---

## Summary

Plan 7 turns the rebuild from "functionally complete, visually generic" into a designed product. It introduces a shared design system, ports the legacy character + icon assets to preserve the warmth Bruno had in the original app, redesigns every existing screen against the new system, and folds three deferred features (email change, heatmap popover, offline Home quote) plus three brand moments (intro animation, goal-reward redesign, empty states) into the sweep.

After Plan 7, the app should feel cohesive, intentional, and personal — ready for Plan 8 to add engagement, monetization, and the Play Store release before the **2026-07-04** dev-account deadline.

---

## Visual decisions (locked during brainstorming)

| Axis                | Decision                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aesthetic direction | Soft Organic (Calm/Headspace energy: warm, daily-ritual, nurturing)                                                                                                                                                                                                                            |
| Palette             | **Sunrise** — peach `#fde7d1` → coral `#f6c7b1` → mauve `#d9b4c7` with coral accent `#d96b5b` and deep ink `#2b1d12`                                                                                                                                                                           |
| Typography          | **Fraunces** (display, variable, optical sizing) + **DM Sans** (body) — both free, Google Fonts, shipped via `expo-font`                                                                                                                                                                       |
| Coach avatar        | Port `my-language-coach/assets/avatar.json` as-is (legacy Lottie character — friendly illustrated woman). Used in: intro screen, goal-reward, and as a small (28px) animated corner avatar on the Practice header. Lottie color overrides deferred to Plan 8 if the teal shirt clashes in-app. |
| App icon            | Port `my-language-coach/assets/icon.png` as-is. Android adaptive icon generated from the same source.                                                                                                                                                                                          |
| Header mark         | Port `my-language-coach/assets/header-icon.png` as-is. Used as a top-left brand mark on the pre-auth screens (Welcome, sign-in, verify) only — post-auth screens have content-specific headers.                                                                                                |
| Intro animation     | Port legacy `AnimatedIntroScreen` pattern: Lottie `avatar.json` + `FadeInView`, ~1.8s, on cold start only. Background recolored from `#f6f9fc` to Sunrise gradient.                                                                                                                            |
| Tab bar             | Floating glass capsule (backdrop-blur) replacing the default Expo Router tab bar.                                                                                                                                                                                                              |
| Mode                | Light only. Dark mode is explicit non-goal — Sunrise is a daylight palette and dark needs its own brainstorm.                                                                                                                                                                                  |

---

## Goals

- **Ship a real design system** (`@language-coach/design-tokens` package) consumed by every screen — no more ad-hoc Tailwind-ish hex codes.
- **Re-skin every existing screen** against the design system: Welcome, sign-in, verify, 4 onboarding screens, Home, Practice, Progress, Profile, 3 edit sheets, not-found.
- **Restore the legacy "personal coach" feel** by porting the legacy avatar + icon + header mark, plus the intro animation.
- **Fold in deferred features:** email change flow, heatmap inline popover, offline Home quote.
- **Redesign brand moments:** intro animation, goal-reward celebration, empty / first-launch states.
- **Fix mobile-audit findings cheap while sweeping:** touch targets <44px (3 sites), no SafeArea (every screen), no ErrorBoundary.

## Non-goals (explicit)

- **Dark mode.** Sunrise is daylight-only; defer.
- **SecureStore migration for Supabase auth tokens.** Real security issue flagged by audit, but plumbing — defer to Plan 8 where we ship to Play Store.
- **Avatar image upload on Profile.** Storage bucket + image picker + crop UI is its own feature. Plan 8+.
- **Quote catalog growth 50 → 200.** Cut from Plan 7 scope — 600 strings of translation work bloats the plan. Plan 8+.
- **Topics, vocab list, push notifications, freemium paywall.** Plan 8.
- **New illustration commissioning.** Port-as-is is the Plan 7 strategy. Fresh illustration is Plan 9+ if ever.
- **Cross-session user-message audio replay.** Still YAGNI from Plan 6.
- **Lottie color overrides at runtime.** The teal shirt on the legacy character may visually clash with Sunrise; we ship as-is and revisit only if it bothers Bruno on device.

---

## 1. Architecture overview

Plan 7 is mostly client-side. No backend routes change. No new tables. One DB-touching feature (email change) goes through Supabase Auth's existing `updateUser` API — no schema work.

New code organisation:

```
app/
├── packages/
│   └── design-tokens/          # NEW — shared design system
│       └── src/
│           ├── colors.ts
│           ├── type.ts
│           ├── spacing.ts
│           ├── radius.ts
│           ├── shadow.ts
│           ├── motion.ts
│           └── index.ts
└── apps/mobile/
    ├── assets/
    │   ├── avatar.json         # NEW — ported from legacy
    │   ├── icon.png            # NEW — ported from legacy
    │   ├── header-icon.png     # NEW — ported from legacy
    │   └── fonts/              # NEW — Fraunces + DM Sans bundled
    ├── src/
    │   ├── design/             # NEW — primitive components
    │   │   ├── Screen.tsx
    │   │   ├── GlassCard.tsx
    │   │   ├── Ring.tsx
    │   │   ├── TabBar.tsx
    │   │   ├── Bubble.tsx
    │   │   ├── EditorialText.tsx
    │   │   ├── FadeInView.tsx
    │   │   └── ErrorBoundary.tsx
    │   └── features/
    │       ├── intro/          # NEW — IntroScreen + cold-start gate
    │       └── auth/           # MODIFIED — adds change-email
```

The existing feature directories (`home/`, `practice/`, `progress/`, `profile/`) keep their structure; only the components inside are re-skinned to consume the new primitives.

---

## 2. Design tokens package

### Location

A new workspace package at `app/packages/design-tokens/`, sibling to `@language-coach/shared`. Published as `@language-coach/design-tokens`. Pure TypeScript, no runtime dependencies, no React Native imports — so it's also consumable from any future web surface (marketing site, etc.).

### Exports

```ts
// colors.ts
export const palette = {
  peach: "#fde7d1",
  coral: "#f6c7b1",
  mauve: "#d9b4c7",
  accent: "#d96b5b",
  ink: "#2b1d12",
  cream: "#fbf6ec",
  glass: "rgba(255,255,255,0.55)",
  glassStrong: "rgba(255,255,255,0.7)",
  white: "#ffffff",
  // semantic
  danger: "#b91c1c",
  dangerSurface: "#fee2e2",
} as const;

export const gradients = {
  sunrise: ["#fde7d1", "#f6c7b1", "#d9b4c7"] as const, // 0% / 50% / 100%
  warmth: ["rgba(255,255,255,0.55)", "transparent"] as const,
  glow: ["rgba(217,107,91,0.18)", "transparent"] as const,
};

export const surface = {
  primary: palette.peach, // base for non-gradient surfaces
  glass: palette.glass,
  glassStrong: palette.glassStrong,
  inkOnLight: palette.ink,
  lightOnInk: palette.peach,
};

// type.ts
export const font = {
  display: "Fraunces_500Medium",
  displayBold: "Fraunces_700Bold",
  displayItalic: "Fraunces_500Medium_Italic",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
} as const;

export const type = {
  displayXl: {
    fontFamily: font.display,
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  displayLg: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  displayMd: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  italic: { fontFamily: font.displayItalic, fontStyle: "italic" as const },
  bodyLg: { fontFamily: font.body, fontSize: 16, lineHeight: 22 },
  bodyMd: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  caps: {
    fontFamily: font.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
};

// spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;
export const touch = { min: 44 } as const;

// radius.ts
export const radius = { sm: 8, md: 14, lg: 22, xl: 28, pill: 999 } as const;

// shadow.ts (RN style objects)
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  floating: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  cta: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
};

// motion.ts
export const motion = {
  duration: { fast: 150, base: 250, slow: 450, intro: 1800 },
  easing: {
    gentle: { damping: 18, stiffness: 120, mass: 1 }, // spring
    decisive: { damping: 22, stiffness: 200, mass: 1 }, // spring
    bezierOut: [0.16, 1, 0.3, 1] as const,
  },
};
```

### Consumption

Every screen, component, and primitive imports from `@language-coach/design-tokens`. No screen defines its own hex codes. Tokens are referenced inline in `StyleSheet.create` calls — no theme context, no styled-components, no extra abstraction. This is the lightest-weight design system that still gives us one source of truth.

---

## 3. Font loading

### Strategy

Bundle the font files in the app — do not download from Google Fonts at runtime. Use `expo-font` with the pre-built `@expo-google-fonts/*` packages:

```sh
pnpm --filter mobile add @expo-google-fonts/fraunces @expo-google-fonts/dm-sans expo-font expo-splash-screen
```

In `app/apps/mobile/app/_layout.tsx`:

```ts
import { useFonts } from "@expo-google-fonts/fraunces";
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;
  // ...rest of root layout
}
```

This guarantees the first frame after splash hides already has the right type — no flash of system font.

---

## 4. Primitive component layer

Lives in `app/apps/mobile/src/design/`. Each primitive is one focused file. None of them know about features or routes; they're pure composable building blocks.

### `<Screen>`

```ts
<Screen variant="gradient">{children}</Screen>
```

- Wraps `SafeAreaView` (fixes audit's no-SafeArea warning everywhere)
- Variant `"gradient"` renders the Sunrise `LinearGradient` background + two soft blob overlays
- Variant `"solid"` renders a flat peach background (for modal sheets, etc.)
- Variant `"ink"` renders deep-ink background (for intro screen only)
- Sets `StatusBar` to dark or light content per variant

### `<GlassCard>`

```ts
<GlassCard padding="lg" radius="lg" strong>{children}</GlassCard>
```

- `BackdropFilter` (via `@react-native-community/blur` or expo-blur — confirm at implementation time which renders better)
- White-translucent surface, optional 1px inset highlight
- Props for padding/radius/border-strength

### `<Ring>`

Animated progress ring (`react-native-svg` + `Animated`, native driver). Used for Home today-progress, possibly elsewhere.

```ts
<Ring progress={0.2} size={56} stroke={6} color={palette.accent} track={palette.glass} />
```

### `<TabBar>`

Replaces the default Expo Router `tabBar`. Floating glass capsule positioned 14px from bottom, 22px from sides. Four tabs: Home, Practice, Progress, Profile. Active tab gets a coral dot indicator beneath the icon and a stronger weight on the label. Custom render via Expo Router's `tabBar` prop in `(tabs)/_layout.tsx`.

### `<Bubble>`

Chat bubble for Practice. `variant="coach"` = glass surface, top-left-rounded corner reduced, ink text. `variant="you"` = ink surface, top-right-rounded corner reduced, peach text. Both inherit `bodyMd` type.

### `<EditorialText>`

Convenience wrapper. `<EditorialText kind="displayLg" italic>` applies the Fraunces type token + optional italic. Saves repeating long type style objects.

### `<FadeInView>`

Mount-fade-in wrapper. Reusable. Used in the intro screen and on any screen that benefits from a soft mount (Home, goal-reward).

### `<ErrorBoundary>`

Class component at the root. Catches render errors, shows a Sunrise-styled fallback screen with "Something went wrong" + a reload button. Fixes audit warning.

---

## 5. Asset porting

Three files copy from `my-language-coach/assets/` into `app/apps/mobile/assets/`:

| Legacy path                                | New path                                 | Use                                                    |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------ |
| `my-language-coach/assets/avatar.json`     | `app/apps/mobile/assets/avatar.json`     | Lottie used in `IntroScreen` and potentially elsewhere |
| `my-language-coach/assets/icon.png`        | `app/apps/mobile/assets/icon.png`        | App icon source for `app.config.ts`                    |
| `my-language-coach/assets/header-icon.png` | `app/apps/mobile/assets/header-icon.png` | Header mark used on Home / Profile headers             |

We also keep the existing `victory.mp3` (already in the rebuild from Plan 6) for the goal-reward sound.

### `app.config.ts` updates

```ts
{
  icon: "./assets/icon.png",
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#fde7d1",  // peach
    },
  },
  splash: {
    image: "./assets/icon.png",
    backgroundColor: "#fde7d1",
    resizeMode: "contain",
  },
}
```

Android adaptive icon background uses the peach base for visual continuity with the intro screen.

### Intro screen

`app/apps/mobile/src/features/intro/IntroScreen.tsx`:

```ts
import LottieView from "lottie-react-native";
import { FadeInView } from "@/src/design/FadeInView";
import { Screen } from "@/src/design/Screen";

export function IntroScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFinish, motion.duration.intro);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <Screen variant="gradient">
      <FadeInView style={styles.center}>
        <LottieView
          source={require("../../../assets/avatar.json")}
          autoPlay
          loop={false}
          style={styles.avatar}
        />
      </FadeInView>
    </Screen>
  );
}
```

Mounted from `_layout.tsx`. Cold-start detection: a `useRef(true)` toggled to `false` after first mount; warm starts (returning from background) skip it.

---

## 6. Screen sweep

Every screen is re-skinned in this order. Each screen is a discrete unit of work — small enough to ship and test on device individually.

| #   | Screen                   | File                                           | Notes                                                              |
| --- | ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Welcome / first-launch   | `app/(onboarding)/_layout.tsx` (root)          | Display "Language Coach" wordmark + Sunrise gradient + sign-in CTA |
| 2   | Sign-in                  | `app/(auth)/sign-in.tsx`                       | Editorial display heading, glass input, ink CTA                    |
| 3   | Verify (OTP)             | `app/(auth)/verify.tsx`                        | Match sign-in style                                                |
| 4a  | Onboarding · name        | `app/(onboarding)/name.tsx`                    | Fraunces prompt, DM Sans input, progress dots                      |
| 4b  | Onboarding · native lang | `app/(onboarding)/native-lang.tsx`             | Glass language picker rows                                         |
| 4c  | Onboarding · target lang | `app/(onboarding)/target-lang.tsx`             | Same pattern                                                       |
| 4d  | Onboarding · daily goal  | `app/(onboarding)/daily-goal.tsx`              | Slider styled with coral accent                                    |
| 5   | Home                     | `app/(tabs)/home.tsx`                          | Per locked mockup                                                  |
| 6   | Practice                 | `app/(tabs)/practice.tsx`                      | Per locked mockup; integrates new `<TopStatusBar>` redesign        |
| 7   | Progress                 | `app/(tabs)/progress.tsx`                      | Per locked mockup; heatmap recolored                               |
| 8   | Profile                  | `app/(tabs)/profile.tsx`                       | Glass rows, Fraunces section labels                                |
| 9   | Edit name sheet          | `src/features/profile/edit-name-sheet.tsx`     | Glass header, ink CTA                                              |
| 10  | Edit goal sheet          | `src/features/profile/edit-goal-sheet.tsx`     | Same pattern                                                       |
| 11  | Edit language sheet      | `src/features/profile/edit-language-sheet.tsx` | Same pattern                                                       |
| 12  | Not-found                | `app/+not-found.tsx`                           | Match the brand instead of looking like a 404                      |

All screens consume `<Screen>` for safe-area + background, `<EditorialText>` for headings, `<GlassCard>` where appropriate. The visual companion mockups (`.superpowers/brainstorm/.../full-mockup.html`) are the visual source of truth for Home, Practice, Progress; remaining screens follow the same design language.

---

## 7. New feature surfaces

### 7.1 Email change flow

A new screen at `app/(auth)/change-email.tsx`, reachable from a new Profile row "Email · `<current>`". Flow:

1. User enters new email
2. Call `supabase.auth.updateUser({ email: newEmail })`
3. Supabase sends a verification email to **both** old and new addresses
4. Show a "Check your email" confirmation screen with instructions
5. After verification, profile email updates automatically on next session refresh

No backend changes. The existing `verify.tsx` pattern provides the visual template. Error handling: invalid email format → inline; Supabase error → toast via existing `showToast`.

### 7.2 Heatmap inline popover

Replace `Alert.alert` in `src/features/progress/heatmap.tsx` (line ~201 of the Plan 5 design doc) with an absolutely-positioned `<GlassCard>` anchored above the tapped cell. Dismiss on tap-outside (handled by a transparent overlay below the popover). Content: date + duration + goal status, e.g. `"May 8 · 12 min · goal hit ✓"` or `"May 9 · no practice"`.

Position math: clamp to screen edges so popovers near the right column don't overflow.

### 7.3 Offline Home quote

`quoteForDay` is already a pure function (Plan 5). Add a tiny AsyncStorage cache layer:

- On every successful quote render, write `{ date: "2026-05-11", quote: {...} }` to `lc.offline-quote`
- On Home mount, if no profile yet (network failure during `useProfile`), read the cache and render the last-known quote as a fallback

The quote translations don't change — they're bundled. The only network dependency is the profile fetch (for `nativeLang` choice). Offline mode keeps the Home screen useful with stale quote data instead of an empty spinner.

---

## 8. Polish layer

### 8.1 Goal-reward redesign

`src/features/practice/goal-reward.tsx` (Plan 6) currently fires confetti + a victory sound. Plan 7 redesigns the foreground:

- Full-screen Sunrise gradient overlay with `<FadeInView>`
- Center: animated `avatar.json` Lottie (single play) — same coach character celebrating
- Below: `<EditorialText kind="displayLg" italic>Goal hit</EditorialText>` + "{streak}-day streak ✿" in DM Sans
- Existing confetti continues to fire on top
- Existing `victory.mp3` continues to play
- Dismiss on tap or after 4s

### 8.2 Empty / first-launch states

- **Practice empty** (no messages yet): Fraunces italic "Tap the mic to say hello." centered, with a subtle pulsing hint arrow down to the mic
- **Progress empty** (no days yet): Fraunces italic "Your first day starts today." + a single illustrated dot in the heatmap row for today, glowing
- **Home before first session** (covered by existing greeting + quote)

### 8.3 Header / top status bar redesign

Plan 6 shipped `top-status-bar.tsx` with timer + listening toggle + streak + exit. Plan 7 redesigns the layout per the visual companion Practice mockup:

- Left: glassy timer pill (`<GlassCard>` rounded pill) with `mm:ss / goal` format, prefixed by a 28px animated `avatar.json` Lottie (looping idle subset — gives the in-session "your coach is here" presence)
- Right: three icon buttons (listening toggle, share, exit) as 32px glass circles, all ≥44px hit-slop
- No background bar — pills float over the Sunrise gradient

The mid-conversation visual anchor remains the existing animated `MicButton` (Plan 6). The chat bubbles + Sunrise gradient + Lottie corner avatar carry the personality; no large in-session avatar is needed.

---

## 9. Mobile audit fixes folded in

| Audit finding                            | Where fixed                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Touch target 24px on `home.tsx`          | Tap targets on streak pill / quote actions get `hitSlop` + min `touch.min` from tokens       |
| Touch target 24px on `progress.tsx`      | Same treatment on streak pill                                                                |
| Touch target 12px on `heatmap.tsx`       | Heatmap cells get `hitSlop` to reach 44px without changing visual cell size                  |
| No SafeArea on every screen              | `<Screen>` primitive wraps SafeAreaView for all screens at once                              |
| No ErrorBoundary                         | Root `<ErrorBoundary>` mounted in `_layout.tsx`                                              |
| Fixed font sizes (no `allowFontScaling`) | All `<Text>` uses default `allowFontScaling=true`; verify no `Text` component forces `false` |
| No dark mode                             | **Deferred — explicit non-goal**                                                             |
| AsyncStorage for auth tokens             | **Deferred to Plan 8** — real security issue, but plumbing                                   |

---

## 10. Order of work

Plan 7 implementation splits into five stages. Each stage is shippable and verifiable on device — we **install a fresh dev build on Bruno's Android device after each stage** and confirm before moving on.

### Stage 1 — Foundation (no visible change yet)

1. Create `@language-coach/design-tokens` package, wire into `app/pnpm-workspace.yaml`
2. Install Fraunces + DM Sans via `@expo-google-fonts/*`, wire `expo-font` + splash gating in `_layout.tsx`
3. Implement `<Screen>`, `<ErrorBoundary>`, `<FadeInView>` primitives
4. Verify: app still runs identically, fonts load, no regressions

### Stage 2 — Brand assets

5. Copy `avatar.json`, `icon.png`, `header-icon.png` into `app/apps/mobile/assets/`
6. Update `app.config.ts` (icon, splash, adaptive icon)
7. Implement `IntroScreen` + cold-start gate in `_layout.tsx`
8. Verify on device: new icon on home screen, intro plays once on cold start, intro skipped on warm start

### Stage 3 — Primitive components

9. Implement `<GlassCard>`, `<Ring>`, `<Bubble>`, `<EditorialText>`, `<TabBar>`
10. Verify in isolation via the existing Profile screen (lightest-risk surface to validate primitives before the sweep)

### Stage 4 — Screen sweep

11. Re-skin screens in order (12 screens listed in section 6). After every 2–3 screens, install a dev build and test the affected flows.
12. Critical checkpoints: after Home (5), after Practice (6), after Progress (7) — these are the daily-use screens.

### Stage 5 — Features + polish

13. Email change flow
14. Heatmap inline popover (replaces `Alert.alert`)
15. Offline Home quote
16. Goal-reward redesign (use the bloom-celebration treatment described in 8.1)
17. Empty states for Practice + Progress
18. Mobile audit fixes (touch-target `hitSlop` where the visual size shouldn't change)
19. Final device pass; if anything's off, iterate; ship a final EAS dev build

---

## 11. Testing strategy

No new automated tests. Visual regression in RN is hard to automate without a dedicated tool we don't have. Instead:

- **After every stage**, install a dev build on Bruno's Android device and walk the affected flows
- **After Stage 4**, walk the full app: cold start → onboarding (if signed out) → sign-in → Home → Practice (full conversation, listening mode, share, end) → Progress (heatmap tap) → Profile (edit each field, change email) → goal-reward (talk past the daily goal)
- **Re-run the mobile audit** (`python scripts/mobile_audit.py app/apps/mobile`) after Stage 5 and confirm the four hard issues (touch targets ×3 + SafeArea) drop to zero. AsyncStorage remains as the deferred Plan 8 item.

---

## 12. Risks

| Risk                                                                                                   | Mitigation                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lottie color overrides at runtime fail** — if the teal shirt looks bad on Sunrise we want a fast fix | Ship as-is; teal-on-coral is a known complementary pair. Only revisit if Bruno flags it on device. Worst case: replace the Lottie file with a manually re-tinted version (Lottie JSON is editable). |
| **Font loading delays splash → first frame**                                                           | `expo-font` preload + `SplashScreen.preventAutoHideAsync` blocks the splash until fonts are ready. If perceived delay >300ms, fall back to bundled subset (medium + regular only).                  |
| **Glass / backdrop-blur perf on low-end Android**                                                      | Confirmed acceptable in Plan 5 (`@gorhom/bottom-sheet` uses backdrop on the same target devices). If FPS drops, fall back to solid white-translucent surfaces on Android.                           |
| **Screen sweep is long; visual regressions accumulate**                                                | Device test after every 2–3 screens. Don't merge a stack of redesigns at once — keep PR-equivalents small.                                                                                          |
| **Tab bar custom render breaks edge cases** (keyboard pushes it, sheets cover it, deep links)          | Test the custom `<TabBar>` against all four tabs + every modal (3 edit sheets) + keyboard-open state.                                                                                               |
| **IntroScreen blocks cold-start time noticeably**                                                      | 1.8s is the Plan 6 spec for greeting playback feel. If it feels long after device test, drop to 1.2s.                                                                                               |

---

## 13. Deferred to Plan 8+ (consolidated)

- Dark mode (Sunrise variant)
- SecureStore migration for Supabase auth tokens
- Avatar image upload on Profile
- Quote catalog 50 → 200
- Lottie color overrides if teal shirt clashes
- Fresh illustration commissioning
- Topics, vocab list, push, freemium paywall body
- Play Store internal track release (before 2026-07-04)
- Cross-session user-message audio replay

---

## 14. Acceptance criteria

Plan 7 is done when, on a fresh Android dev build:

1. App icon on the home screen is the legacy character mark
2. Cold start shows the intro Lottie on a Sunrise gradient, then resolves to the destination screen after ~1.8s
3. Warm start skips the intro
4. Every screen renders in Sunrise palette with Fraunces display + DM Sans body
5. Glass tab bar floats at the bottom and works across all four tabs
6. In-session Lottie character animates as a small corner avatar in the Practice header timer pill, and a larger center-screen Lottie plays on goal-reward
7. Heatmap cell tap shows an inline popover, not `Alert.alert`
8. Profile has a working Email row that triggers Supabase email change
9. Home renders a cached quote when offline (airplane mode test)
10. Goal-reward fires the redesigned celebration with the avatar character
11. Empty Practice and empty Progress show editorial states, not blank scrolls
12. Mobile audit reports zero touch-target issues and zero SafeArea warnings
13. No regressions in Plan 6 voice-loop behavior

---

## Appendix — Visual companion artifacts

Mockups produced during brainstorming, saved at:

```
.superpowers/brainstorm/852-1778479609/content/
├── aesthetic-direction.html   (locked: Soft Organic)
├── palette.html               (locked: Sunrise)
├── typography.html            (locked: Fraunces + DM Sans)
├── avatar.html                (initial: Warm Orb — superseded)
├── full-mockup.html           (locked: Home + Practice + Progress vision)
├── icon-and-intro.html        (initial — superseded)
└── avatar-rethink.html        (locked: A — port legacy avatar.json)
```

**Remember to add `.superpowers/` to `app/.gitignore`** so the brainstorm dir doesn't get committed to the new monorepo (workspace root isn't a git repo, but `app/` is).
