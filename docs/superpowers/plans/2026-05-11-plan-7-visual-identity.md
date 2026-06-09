# Plan 7: Visual identity polish + design system — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Bruno has authorized **autonomous parallel execution** on prior plans — apply the same pattern here: drop the formal review subagents for screen-sweep batches and trust the implementers, verify diffs inline. Trigger an EAS dev build at the very end.

**Goal:** Convert the rebuild from "functionally complete, visually generic" into a designed product: a shared design tokens package, ported legacy character + icon, re-skinned screens, three deferred features (email change, heatmap popover, offline quote), and three brand moments (intro, goal-reward, empty states).

**Architecture:** New `@language-coach/design-tokens` package consumed by every screen. A small primitive layer in `apps/mobile/src/design/` (`<Screen>`, `<GlassCard>`, `<Ring>`, `<TabBar>`, `<Bubble>`, `<EditorialText>`, `<FadeInView>`, `<ErrorBoundary>`). Legacy assets ported as-is from `my-language-coach/assets/`. Every existing mobile screen re-skinned against the new primitives. Email change goes through Supabase Auth (`updateUser`). Heatmap popover replaces `Alert.alert` with an absolutely-positioned `<GlassCard>`. Offline quote caches `quoteForDay` output in AsyncStorage.

**Tech Stack:** Expo SDK 54 + Expo Router 6, NativeWind (existing), `lottie-react-native` (new), `expo-blur` (new), `@expo-google-fonts/fraunces` + `@expo-google-fonts/dm-sans` (new), `react-native-svg` (new for `<Ring>`), Supabase Auth (existing).

**Spec:** `docs/superpowers/specs/2026-05-11-plan-7-visual-identity-design.md`

**Working directory:** `app/` (the monorepo — this plan does not touch the legacy `my-language-coach/` or `my-language-coach-backend/`, only copies files out).

---

## File map

**New package:**

- `app/packages/design-tokens/package.json`
- `app/packages/design-tokens/tsconfig.json`
- `app/packages/design-tokens/src/index.ts`
- `app/packages/design-tokens/src/colors.ts`
- `app/packages/design-tokens/src/type.ts`
- `app/packages/design-tokens/src/spacing.ts`
- `app/packages/design-tokens/src/radius.ts`
- `app/packages/design-tokens/src/shadow.ts`
- `app/packages/design-tokens/src/motion.ts`

**New primitive layer (mobile):**

- `app/apps/mobile/src/design/Screen.tsx`
- `app/apps/mobile/src/design/GlassCard.tsx`
- `app/apps/mobile/src/design/Ring.tsx`
- `app/apps/mobile/src/design/TabBar.tsx`
- `app/apps/mobile/src/design/Bubble.tsx`
- `app/apps/mobile/src/design/EditorialText.tsx`
- `app/apps/mobile/src/design/FadeInView.tsx`
- `app/apps/mobile/src/design/ErrorBoundary.tsx`
- `app/apps/mobile/src/design/index.ts`

**New features:**

- `app/apps/mobile/src/features/intro/IntroScreen.tsx`
- `app/apps/mobile/src/features/intro/use-cold-start.ts`
- `app/apps/mobile/app/(auth)/change-email.tsx`
- `app/apps/mobile/src/features/home/use-offline-quote.ts`
- `app/apps/mobile/src/features/progress/heatmap-popover.tsx`

**New assets (copied from legacy):**

- `app/apps/mobile/assets/avatar.json`
- `app/apps/mobile/assets/icon.png`
- `app/apps/mobile/assets/header-icon.png`

**Modified (mobile screens):**

- `app/apps/mobile/app/_layout.tsx` — font loading, splash gating, ErrorBoundary, IntroScreen mount
- `app/apps/mobile/app/(tabs)/_layout.tsx` — custom `<TabBar>` render
- `app/apps/mobile/app/(tabs)/home.tsx` — full re-skin
- `app/apps/mobile/app/(tabs)/practice.tsx` — full re-skin
- `app/apps/mobile/app/(tabs)/progress.tsx` — full re-skin + heatmap popover
- `app/apps/mobile/app/(tabs)/profile.tsx` — full re-skin + Email row
- `app/apps/mobile/app/(auth)/_layout.tsx` — header-icon brand mark
- `app/apps/mobile/app/(auth)/sign-in.tsx` — full re-skin
- `app/apps/mobile/app/(auth)/verify.tsx` — full re-skin
- `app/apps/mobile/app/(onboarding)/_layout.tsx` — header-icon brand mark + Screen wrap
- `app/apps/mobile/app/(onboarding)/name.tsx` — full re-skin
- `app/apps/mobile/app/(onboarding)/native-lang.tsx` — full re-skin
- `app/apps/mobile/app/(onboarding)/target-lang.tsx` — full re-skin
- `app/apps/mobile/app/(onboarding)/daily-goal.tsx` — full re-skin
- `app/apps/mobile/app/+not-found.tsx` — full re-skin
- `app/apps/mobile/app/index.tsx` — keep auth-redirect logic, no UI changes needed
- `app/apps/mobile/src/features/practice/top-status-bar.tsx` — full redesign (timer pill + corner Lottie + icon row)
- `app/apps/mobile/src/features/practice/MessageBubble.tsx` — consume `<Bubble>` primitive
- `app/apps/mobile/src/features/practice/MicButton.tsx` — restyle with token colors
- `app/apps/mobile/src/features/practice/goal-reward.tsx` — full redesign with Lottie + Fraunces callout
- `app/apps/mobile/src/features/progress/heatmap.tsx` — replace `Alert.alert` with popover, recolor cells
- `app/apps/mobile/src/features/progress/stats-row.tsx` — restyle stat cards with Fraunces numbers
- `app/apps/mobile/src/features/home/quote-card.tsx` — restyle as `<GlassCard>`
- `app/apps/mobile/src/features/home/today-progress.tsx` — replace bar with `<Ring>`
- `app/apps/mobile/src/features/home/use-today-stats.ts` — no logic change (read-only ref)
- `app/apps/mobile/src/features/profile/profile-row.tsx` — restyle for glass surface
- `app/apps/mobile/src/features/profile/edit-name-sheet.tsx` — restyle
- `app/apps/mobile/src/features/profile/edit-goal-sheet.tsx` — restyle
- `app/apps/mobile/src/features/profile/edit-language-sheet.tsx` — restyle
- `app/apps/mobile/app.config.ts` — icon, splash, adaptive icon, font assets bundling
- `app/apps/mobile/package.json` — add new deps
- `app/pnpm-workspace.yaml` — already covers `packages/*`, verify
- `app/.gitignore` — add `.superpowers/`

---

## Execution batches (autonomous parallel)

- **Phase 0 — Sequential:** Tasks 1, 2 (design-tokens package + deps install — modifies lockfile and workspace)
- **Phase 1 — Sequential:** Task 3 (asset copy from legacy)
- **Phase 2 — Sequential:** Task 4 (app.config.ts) and Task 5 (`_layout.tsx` font loading + ErrorBoundary)
- **Phase 3 — Batch A (3 in parallel):** Tasks 6, 7, 8 (Screen, FadeInView, ErrorBoundary primitives)
- **Phase 4 — Batch B (5 in parallel):** Tasks 9, 10, 11, 12, 13 (GlassCard, Ring, Bubble, EditorialText, TabBar)
- **Phase 5 — Sequential:** Task 14 (wire `<TabBar>` + Task 15 (IntroScreen + cold-start) — both touch `_layout.tsx`
- **Phase 6 — Checkpoint:** Manual device test (Bruno installs dev build, confirms foundation looks right)
- **Phase 7 — Batch C (10 in parallel — screen sweep):** Tasks 16-25
- **Phase 8 — Checkpoint:** Manual device test (Bruno walks every screen)
- **Phase 9 — Batch D (5 in parallel):** Tasks 26-30 (email change, heatmap popover, offline quote, goal-reward, empty states)
- **Phase 10 — Sequential:** Task 31 (audit cleanup + audit re-run + EAS dev build + CLAUDE.md update)

---

## Phase 0 — Workspace foundation

### Task 1: Create `@language-coach/design-tokens` package

**Files:**

- Create: `app/packages/design-tokens/package.json`
- Create: `app/packages/design-tokens/tsconfig.json`
- Create: `app/packages/design-tokens/src/index.ts`
- Create: `app/packages/design-tokens/src/colors.ts`
- Create: `app/packages/design-tokens/src/type.ts`
- Create: `app/packages/design-tokens/src/spacing.ts`
- Create: `app/packages/design-tokens/src/radius.ts`
- Create: `app/packages/design-tokens/src/shadow.ts`
- Create: `app/packages/design-tokens/src/motion.ts`
- Verify: `app/pnpm-workspace.yaml` already includes `packages/*`

- [ ] **Step 1: Create the package.json**

File: `app/packages/design-tokens/package.json`

```json
{
  "name": "@language-coach/design-tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@language-coach/config": "workspace:*",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

File: `app/packages/design-tokens/tsconfig.json`

```json
{
  "extends": "@language-coach/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `src/colors.ts`**

```ts
export const palette = {
  peach: "#fde7d1",
  coral: "#f6c7b1",
  mauve: "#d9b4c7",
  accent: "#d96b5b",
  accentDeep: "#a04130",
  ink: "#2b1d12",
  inkSoft: "#3a2520",
  cream: "#fbf6ec",
  white: "#ffffff",
  glass: "rgba(255, 255, 255, 0.55)",
  glassStrong: "rgba(255, 255, 255, 0.7)",
  glassFaint: "rgba(255, 255, 255, 0.35)",
  danger: "#b91c1c",
  dangerSurface: "#fee2e2",
  shadowTint: "rgba(43, 29, 18, 0.28)",
} as const;

export const gradients = {
  sunrise: ["#fde7d1", "#f6c7b1", "#d9b4c7"] as const,
  warmth: ["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"] as const,
  glow: ["rgba(217,107,91,0.18)", "rgba(217,107,91,0)"] as const,
} as const;

export const surface = {
  primary: palette.peach,
  glass: palette.glass,
  glassStrong: palette.glassStrong,
  inkOnLight: palette.ink,
  lightOnInk: palette.peach,
} as const;
```

- [ ] **Step 4: Create `src/type.ts`**

```ts
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
} as const;
```

- [ ] **Step 5: Create `src/spacing.ts`**

```ts
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
```

- [ ] **Step 6: Create `src/radius.ts`**

```ts
export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;
```

- [ ] **Step 7: Create `src/shadow.ts`**

```ts
import { palette } from "./colors";

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
} as const;
```

- [ ] **Step 8: Create `src/motion.ts`**

```ts
export const motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 450,
    intro: 1800,
  },
  spring: {
    gentle: { damping: 18, stiffness: 120, mass: 1 },
    decisive: { damping: 22, stiffness: 200, mass: 1 },
  },
  bezier: {
    out: [0.16, 1, 0.3, 1] as const,
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
} as const;
```

- [ ] **Step 9: Create `src/index.ts`**

```ts
export * from "./colors";
export * from "./type";
export * from "./spacing";
export * from "./radius";
export * from "./shadow";
export * from "./motion";
```

- [ ] **Step 10: Verify pnpm-workspace.yaml includes packages/\***

Run: `cat app/pnpm-workspace.yaml`

Expected output contains:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

If not, add the `packages/*` line.

- [ ] **Step 11: Install workspace and verify typecheck**

From `app/`:

```sh
pnpm install
pnpm --filter @language-coach/design-tokens typecheck
```

Expected: install succeeds, typecheck passes with no errors.

- [ ] **Step 12: Commit**

```sh
cd app
git add packages/design-tokens pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(design-tokens): scaffold @language-coach/design-tokens package"
```

---

### Task 2: Install mobile dependencies + design-tokens link

**Files:**

- Modify: `app/apps/mobile/package.json`
- Modify: `app/pnpm-lock.yaml`

- [ ] **Step 1: Install new dependencies**

From `app/`:

```sh
pnpm --filter mobile add @language-coach/design-tokens@workspace:*
pnpm --filter mobile add lottie-react-native expo-blur expo-linear-gradient react-native-svg
pnpm --filter mobile add @expo-google-fonts/fraunces @expo-google-fonts/dm-sans
```

Expected: install succeeds, mobile `package.json` lists all six new deps + the workspace link.

- [ ] **Step 2: Verify expo-doctor health**

```sh
cd app/apps/mobile
npx expo-doctor
```

Expected: zero warnings about duplicate native modules (lottie-react-native + react-native-svg are both native; expo-doctor catches duplicates that cause the "[runtime not ready]" startup error from Plan 5 lessons).

If duplicates appear, follow Plan 5's nuclear remediation: `rm -rf node_modules`, `pnpm install` from `app/`, then `rm -rf` any real (non-symlink) directories at the workspace root for the duplicated package.

- [ ] **Step 3: Verify mobile typecheck still passes**

```sh
pnpm --filter mobile typecheck
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```sh
cd app
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add design-tokens link, lottie, blur, svg, fonts"
```

---

## Phase 1 — Asset porting

### Task 3: Copy legacy assets

**Files:**

- Create: `app/apps/mobile/assets/avatar.json` (copy from `my-language-coach/assets/avatar.json`)
- Create: `app/apps/mobile/assets/icon.png` (copy from `my-language-coach/assets/icon.png`)
- Create: `app/apps/mobile/assets/header-icon.png` (copy from `my-language-coach/assets/header-icon.png`)

- [ ] **Step 1: Copy the three assets**

From the workspace root:

```sh
cp "my-language-coach/assets/avatar.json" "app/apps/mobile/assets/avatar.json"
cp "my-language-coach/assets/icon.png" "app/apps/mobile/assets/icon.png"
cp "my-language-coach/assets/header-icon.png" "app/apps/mobile/assets/header-icon.png"
```

- [ ] **Step 2: Verify files exist and are non-empty**

```sh
ls -lh app/apps/mobile/assets/avatar.json app/apps/mobile/assets/icon.png app/apps/mobile/assets/header-icon.png
```

Expected: all three files listed, sizes > 0.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/assets/avatar.json apps/mobile/assets/icon.png apps/mobile/assets/header-icon.png
git commit -m "feat(mobile): port legacy avatar/icon/header assets"
```

---

## Phase 2 — App config + font loading

### Task 4: Update `app.config.ts`

**Files:**

- Modify: `app/apps/mobile/app.config.ts`

- [ ] **Step 1: Update icon, splash, adaptive icon to use the new asset**

Replace the entire `app.config.ts` content with:

```ts
import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "My Language Coach",
  slug: "my-language-coach",
  scheme: "mylanguagecoach",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#fde7d1",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.brunomoise.mylanguagecoach",
  },
  android: {
    package: "com.anonymous.mylanguagecoach",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#fde7d1",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    "expo-audio",
    [
      "@sentry/react-native/expo",
      {
        organization: "bruno77176",
        project: "language-coach-mobile",
      },
    ],
  ],
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SENTRY_DSN_MOBILE: process.env.SENTRY_DSN_MOBILE,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
```

Key changes: added `icon`, `splash` (full block), changed `android.adaptiveIcon.foregroundImage` from `adaptive-icon.png` to `icon.png` and the background from `#ffffff` to `#fde7d1` (Sunrise peach).

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): wire ported icon + Sunrise splash background"
```

---

### Task 5: Add `.superpowers/` to `app/.gitignore`

**Files:**

- Modify: `app/.gitignore`

- [ ] **Step 1: Read current gitignore**

```sh
cat app/.gitignore
```

- [ ] **Step 2: Append `.superpowers/` if not already present**

If `.superpowers/` is not in the file, append a line:

```
.superpowers/
```

- [ ] **Step 3: Commit**

```sh
cd app
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm artifacts"
```

---

## Phase 3 — Foundation primitives (Batch A, 3 in parallel)

### Task 6: `<Screen>` primitive + SafeArea wrap

**Files:**

- Create: `app/apps/mobile/src/design/Screen.tsx`

- [ ] **Step 1: Implement Screen**

```tsx
import { ReactNode } from "react";
import { StatusBar, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, palette } from "@language-coach/design-tokens";

type Variant = "gradient" | "solid" | "ink";

type Props = {
  children: ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  /** When true, do not wrap in SafeAreaView (useful for modals that handle their own insets). */
  edgeToEdge?: boolean;
};

export function Screen({
  children,
  variant = "gradient",
  style,
  edgeToEdge = false,
}: Props) {
  const Container = edgeToEdge ? View : SafeAreaView;
  const isInk = variant === "ink";

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={isInk ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      {variant === "gradient" && (
        <>
          <LinearGradient
            colors={[...gradients.sunrise]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[...gradients.warmth]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.7 }}
            style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          />
        </>
      )}
      {variant === "solid" && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.peach }]}
        />
      )}
      {variant === "ink" && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink }]}
        />
      )}
      <Container style={[styles.container, style]}>{children}</Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/Screen.tsx
git commit -m "feat(design): add <Screen> primitive with Sunrise gradient + SafeArea"
```

---

### Task 7: `<FadeInView>` primitive

**Files:**

- Create: `app/apps/mobile/src/design/FadeInView.tsx`

- [ ] **Step 1: Implement FadeInView**

```tsx
import { ReactNode, useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { motion } from "@language-coach/design-tokens";

type Props = {
  children: ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  fromY?: number;
};

export function FadeInView({
  children,
  duration = motion.duration.slow,
  delay = 0,
  style,
  fromY = 0,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration, delay]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/FadeInView.tsx
git commit -m "feat(design): add <FadeInView> animated mount wrapper"
```

---

### Task 8: `<ErrorBoundary>` primitive

**Files:**

- Create: `app/apps/mobile/src/design/ErrorBoundary.tsx`

- [ ] **Step 1: Implement ErrorBoundary**

```tsx
import { Component, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { palette, radius, spacing, type } from "@language-coach/design-tokens";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.body}>
            Restart the app to keep going. We&apos;ve been notified.
          </Text>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.peach,
    padding: spacing.xl,
  },
  title: { ...type.displayLg, color: palette.ink, textAlign: "center" },
  body: {
    ...type.bodyMd,
    color: palette.inkSoft,
    textAlign: "center",
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: palette.ink,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  buttonText: { ...type.bodyMd, color: palette.peach, fontWeight: "600" },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/ErrorBoundary.tsx
git commit -m "feat(design): add root <ErrorBoundary> with Sentry capture"
```

---

## Phase 4 — Design primitives (Batch B, 5 in parallel)

### Task 9: `<GlassCard>` primitive

**Files:**

- Create: `app/apps/mobile/src/design/GlassCard.tsx`

- [ ] **Step 1: Implement GlassCard**

```tsx
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Props = {
  children: ReactNode;
  padding?: keyof typeof spacing;
  radiusToken?: keyof typeof radius;
  strong?: boolean;
  style?: ViewStyle;
};

export function GlassCard({
  children,
  padding = "base",
  radiusToken = "lg",
  strong = false,
  style,
}: Props) {
  const r = radius[radiusToken];
  const p = spacing[padding];
  const fallbackBg = strong ? palette.glassStrong : palette.glass;

  return (
    <View style={[styles.shadow, { borderRadius: r }, style]}>
      {Platform.OS === "android" ? (
        <View
          style={[
            styles.inner,
            { borderRadius: r, padding: p, backgroundColor: fallbackBg },
          ]}
        >
          {children}
        </View>
      ) : (
        <BlurView
          intensity={strong ? 30 : 18}
          tint="light"
          style={[
            styles.inner,
            { borderRadius: r, padding: p, backgroundColor: fallbackBg },
          ]}
        >
          {children}
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { ...shadow.card },
  inner: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
});
```

Per Plan 5 lesson: backdrop-blur perf on low-end Android is uncertain; ship Android with the solid translucent fallback already in place.

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/GlassCard.tsx
git commit -m "feat(design): add <GlassCard> with iOS blur + Android fallback"
```

---

### Task 10: `<Ring>` animated progress ring

**Files:**

- Create: `app/apps/mobile/src/design/Ring.tsx`

- [ ] **Step 1: Implement Ring**

```tsx
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { motion, palette, type } from "@language-coach/design-tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** Optional label rendered at the center, e.g. "2′" */
  label?: string;
};

export function Ring({
  progress,
  size = 56,
  stroke = 6,
  color = palette.accent,
  trackColor = palette.glassStrong,
  label,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radiusPx = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: clamped,
      duration: motion.duration.slow,
      useNativeDriver: false,
    }).start();
  }, [animated, clamped]);

  const strokeDashoffset = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {label && (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  } as never,
  label: { ...type.displayMd, color: palette.ink },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/Ring.tsx
git commit -m "feat(design): add <Ring> animated progress ring"
```

---

### Task 11: `<Bubble>` chat bubble

**Files:**

- Create: `app/apps/mobile/src/design/Bubble.tsx`

- [ ] **Step 1: Implement Bubble**

```tsx
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Variant = "coach" | "you";

type Props = {
  variant: Variant;
  children: ReactNode;
  style?: ViewStyle;
};

export function Bubble({ variant, children, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === "coach" ? styles.coach : styles.you,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    maxWidth: "78%",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  coach: {
    alignSelf: "flex-start",
    backgroundColor: palette.glassStrong,
    borderTopLeftRadius: spacing.sm,
  },
  you: {
    alignSelf: "flex-end",
    backgroundColor: palette.ink,
    borderTopRightRadius: spacing.sm,
  },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/Bubble.tsx
git commit -m "feat(design): add <Bubble> chat bubble (coach + you variants)"
```

---

### Task 12: `<EditorialText>` typographic wrapper

**Files:**

- Create: `app/apps/mobile/src/design/EditorialText.tsx`
- Create: `app/apps/mobile/src/design/index.ts`

- [ ] **Step 1: Implement EditorialText**

```tsx
import { ReactNode } from "react";
import { StyleSheet, Text, TextStyle } from "react-native";
import { palette, type as tokens } from "@language-coach/design-tokens";

type Kind = keyof typeof tokens;

type Props = {
  children: ReactNode;
  kind?: Kind;
  italic?: boolean;
  color?: string;
  align?: "auto" | "left" | "right" | "center";
  style?: TextStyle;
};

export function EditorialText({
  children,
  kind = "bodyMd",
  italic = false,
  color = palette.ink,
  align,
  style,
}: Props) {
  const base = tokens[kind];
  const italicLayer = italic ? tokens.italic : null;

  return (
    <Text style={[base, italicLayer, { color, textAlign: align }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({});
```

- [ ] **Step 2: Create `src/design/index.ts` barrel**

```ts
export { Screen } from "./Screen";
export { FadeInView } from "./FadeInView";
export { ErrorBoundary } from "./ErrorBoundary";
export { GlassCard } from "./GlassCard";
export { Ring } from "./Ring";
export { Bubble } from "./Bubble";
export { EditorialText } from "./EditorialText";
export { TabBar } from "./TabBar";
```

`TabBar` is created in Task 13; the export reference here is fine because the barrel is only consumed after Task 13 lands. If parallel execution breaks the build between Tasks 12 and 13, comment the `TabBar` export until 13 completes.

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS once Task 13 also lands. If running this task alone, comment the `TabBar` export.

- [ ] **Step 4: Commit**

```sh
cd app
git add apps/mobile/src/design/EditorialText.tsx apps/mobile/src/design/index.ts
git commit -m "feat(design): add <EditorialText> + design barrel"
```

---

### Task 13: `<TabBar>` floating glass tab bar

**Files:**

- Create: `app/apps/mobile/src/design/TabBar.tsx`

- [ ] **Step 1: Implement TabBar**

```tsx
import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import {
  palette,
  radius,
  shadow,
  spacing,
  touch,
} from "@language-coach/design-tokens";
import { EditorialText } from "./EditorialText";
import { GlassCard } from "./GlassCard";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  practice: "chatbubble-ellipses-outline",
  progress: "stats-chart-outline",
  profile: "person-outline",
};

const ICONS_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  practice: "chatbubble-ellipses",
  progress: "stats-chart",
  profile: "person",
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <GlassCard padding="sm" radiusToken="xl" strong style={styles.bar}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label =
              (options.tabBarLabel as string | undefined) ??
              options.title ??
              route.name;
            const iconName = focused
              ? (ICONS_ACTIVE[route.name] ?? "ellipse")
              : (ICONS[route.name] ?? "ellipse-outline");

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tab}
                hitSlop={8}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={focused ? palette.accent : palette.inkSoft}
                />
                <EditorialText
                  kind="bodySm"
                  color={focused ? palette.accent : palette.inkSoft}
                  style={{ fontWeight: focused ? "600" : "400", marginTop: 2 }}
                >
                  {label}
                </EditorialText>
                <View style={[styles.dot, focused && styles.dotActive]} />
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    ...shadow.floating,
  },
  bar: { borderRadius: radius.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    flex: 1,
    minHeight: touch.min,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    marginTop: 3,
    opacity: 0,
  },
  dotActive: { opacity: 1 },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/design/TabBar.tsx
git commit -m "feat(design): add floating glass <TabBar>"
```

---

## Phase 5 — Wire foundation into root

### Task 14: Wire `<TabBar>` into `(tabs)/_layout.tsx`

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace `(tabs)/_layout.tsx` to use custom TabBar**

```tsx
import { Tabs } from "expo-router";
import { TabBar } from "@/src/design";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="practice" options={{ title: "Practice" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): swap default tab bar for floating glass TabBar"
```

---

### Task 15: Font loading + ErrorBoundary + IntroScreen in root layout

**Files:**

- Modify: `app/apps/mobile/app/_layout.tsx`
- Create: `app/apps/mobile/src/features/intro/IntroScreen.tsx`
- Create: `app/apps/mobile/src/features/intro/use-cold-start.ts`

- [ ] **Step 1: Create `use-cold-start.ts`**

```ts
import { useState } from "react";

let hasMounted = false;

/**
 * Returns true on the first render of the app's lifetime, false thereafter.
 * Used to gate the intro animation so it only plays on cold start, not when
 * resuming from background.
 */
export function useColdStart(): boolean {
  const [coldStart] = useState(() => {
    if (hasMounted) return false;
    hasMounted = true;
    return true;
  });
  return coldStart;
}
```

- [ ] **Step 2: Create `IntroScreen.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import { FadeInView, Screen } from "@/src/design";
import { motion } from "@language-coach/design-tokens";

type Props = { onFinish: () => void };

export function IntroScreen({ onFinish }: Props) {
  const lottie = useRef<LottieView>(null);

  useEffect(() => {
    const timer = setTimeout(onFinish, motion.duration.intro);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <Screen variant="gradient">
      <FadeInView style={styles.center} duration={motion.duration.slow}>
        <LottieView
          ref={lottie}
          source={require("../../../assets/avatar.json")}
          autoPlay
          loop={false}
          style={styles.avatar}
        />
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 220, height: 220 },
});
```

- [ ] **Step 3: Rewrite `app/_layout.tsx`**

```tsx
import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
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
import { supabase } from "@/src/lib/supabase";
import { queryClient } from "@/src/lib/query-client";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { ErrorBoundary } from "@/src/design";
import { IntroScreen } from "@/src/features/intro/IntroScreen";
import { useColdStart } from "@/src/features/intro/use-cold-start";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const coldStart = useColdStart();
  const [introDone, setIntroDone] = useState(!coldStart);

  const [fontsReady] = useFonts({
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            {!introDone ? (
              <IntroScreen onFinish={() => setIntroDone(true)} />
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            )}
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

The legacy `<StatusBar style="dark" />` is dropped — `<Screen>` now controls status bar appearance per variant.

- [ ] **Step 4: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
cd app
git add apps/mobile/app/_layout.tsx apps/mobile/src/features/intro
git commit -m "feat(mobile): preload fonts, mount ErrorBoundary, gate intro on cold start"
```

---

## Phase 6 — CHECKPOINT (manual device test)

> 🛑 **STOP for Bruno.** Trigger an EAS dev build, install on his Android device, confirm:
>
> - Splash screen shows new icon on peach background
> - Intro Lottie plays once on cold start (~1.8s)
> - App lands on existing screens (still using old styling — expected)
> - Existing screens still functional (no regressions)
> - Tab bar now floats as a glass capsule at the bottom
>
> If anything looks wrong, fix before proceeding to Phase 7.

```sh
cd app/apps/mobile
eas build --profile development --platform android
```

---

## Phase 7 — Screen sweep (Batch C, 10 in parallel)

> Each of these tasks is independent. Subagents can take them in parallel. Each task touches one or two files only.

### Task 16: Re-skin Welcome / `(auth)/_layout.tsx`

**Files:**

- Modify: `app/apps/mobile/app/(auth)/_layout.tsx`

- [ ] **Step 1: Read current layout**

```sh
cat "app/apps/mobile/app/(auth)/_layout.tsx"
```

- [ ] **Step 2: Replace contents**

```tsx
import { Stack } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { Screen } from "@/src/design";
import { spacing } from "@language-coach/design-tokens";

export default function AuthLayout() {
  return (
    <Screen variant="gradient">
      <View style={styles.brand}>
        <Image
          source={require("../../assets/header-icon.png")}
          style={styles.mark}
        />
      </View>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  mark: { width: 36, height: 36 },
});
```

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(auth)/_layout.tsx"
git commit -m "feat(auth): Sunrise gradient layout with header-icon brand mark"
```

---

### Task 17: Re-skin sign-in screen

**Files:**

- Modify: `app/apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Read current screen**

```sh
cat "app/apps/mobile/app/(auth)/sign-in.tsx"
```

- [ ] **Step 2: Apply new visual language**

Replace the existing styles + JSX so the screen uses `<EditorialText>` for headings, `<GlassCard>` for the form surface, and the ink CTA pattern from the Home mockup. Specific changes:

- Replace any inline `Text` heading with `<EditorialText kind="displayLg">` for the page title and `<EditorialText kind="bodyMd" color={palette.inkSoft}>` for supporting copy.
- Wrap the email `TextInput` in a `<GlassCard padding="md">` with the input inheriting `type.bodyLg` from design tokens (no border on the input — the glass surface IS the border).
- Replace the submit button with a `Pressable` styled: `backgroundColor: palette.ink`, `paddingVertical: spacing.base + 2`, `borderRadius: radius.lg`, `...shadow.cta`. Label text: `<EditorialText kind="bodyLg" color={palette.peach}>Send link</EditorialText>` (or whatever the existing button copy is).
- Remove the screen-level `<View style={{ backgroundColor: "#fff" }}>` wrapper — the `<Screen>` from `(auth)/_layout.tsx` already provides background.

Keep all existing handlers, state, and Supabase calls unchanged. This is a pure visual sweep.

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(auth)/sign-in.tsx"
git commit -m "feat(auth): re-skin sign-in with EditorialText + GlassCard + ink CTA"
```

---

### Task 18: Re-skin verify (OTP) screen

**Files:**

- Modify: `app/apps/mobile/app/(auth)/verify.tsx`

- [ ] **Step 1: Apply same visual pattern as sign-in (Task 17)**

The OTP input uses the same `<GlassCard>` wrapper; the heading uses `<EditorialText kind="displayLg">`; the verify button uses the ink CTA style. The 6-digit OTP entry pattern stays the same; just restyle the container and box backgrounds.

Specifically:

- Replace background color literals (`#fff`, `#f3f4f6`) with `transparent` / `palette.glass`
- Replace any `fontSize: 24, fontWeight: "700"` heading with `<EditorialText kind="displayLg">`
- OTP digit boxes get `backgroundColor: palette.glass`, `borderRadius: radius.md`, `borderColor: palette.glassFaint`, focused state: `borderColor: palette.accent`

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add "apps/mobile/app/(auth)/verify.tsx"
git commit -m "feat(auth): re-skin verify (OTP) with Sunrise design language"
```

---

### Task 19: Re-skin onboarding (4 screens + layout)

**Files:**

- Modify: `app/apps/mobile/app/(onboarding)/_layout.tsx`
- Modify: `app/apps/mobile/app/(onboarding)/name.tsx`
- Modify: `app/apps/mobile/app/(onboarding)/native-lang.tsx`
- Modify: `app/apps/mobile/app/(onboarding)/target-lang.tsx`
- Modify: `app/apps/mobile/app/(onboarding)/daily-goal.tsx`

- [ ] **Step 1: Update layout to wrap in `<Screen>` with brand mark**

Use the same pattern as `(auth)/_layout.tsx` from Task 16 — `<Screen variant="gradient">` + `header-icon.png` top-left.

- [ ] **Step 2: Apply visual pattern to each of the four screens**

Each onboarding screen follows the same template:

- `<EditorialText kind="displayLg">` for the question (e.g. "What should we call you?")
- `<EditorialText kind="bodyMd" color={palette.inkSoft}>` for supporting copy
- Form input or language picker wrapped in `<GlassCard>`
- Bottom-anchored ink CTA `<Pressable>` with `<EditorialText kind="bodyLg" color={palette.peach}>` label
- Progress dots row at top: 4 small dots, current one filled `palette.accent`, others `palette.glassFaint`

For `native-lang.tsx` and `target-lang.tsx`: the language list is a scrollable column of `<GlassCard padding="md">` rows. Each row: flag + language name + check mark when selected. Touch target ≥ `touch.min`.

For `daily-goal.tsx`: replace any default slider with a custom view that has 5/10/15/20/30 minute pills the user taps. Each pill: `<GlassCard radiusToken="pill">` when unselected, `backgroundColor: palette.ink` with white text when selected.

Keep all routing + persistence logic untouched.

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(onboarding)"
git commit -m "feat(onboarding): re-skin all 4 onboarding screens + layout"
```

---

### Task 20: Re-skin Home screen

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/home.tsx`
- Modify: `app/apps/mobile/src/features/home/quote-card.tsx`
- Modify: `app/apps/mobile/src/features/home/today-progress.tsx`

- [ ] **Step 1: Rewrite `home.tsx` to match the locked mockup**

```tsx
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { quoteForDay, type SupportedLang } from "@language-coach/shared";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";
import { EditorialText, GlassCard, Screen } from "@/src/design";
import { useProfile } from "@/src/features/auth/use-profile";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import { QuoteCard } from "@/src/features/home/quote-card";
import { TodayProgress } from "@/src/features/home/today-progress";
import { supabase } from "@/src/lib/supabase";

function useCurrentStreak() {
  return useQuery<number>({
    queryKey: ["current-streak"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_streak");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

function dateLabel(timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: stats } = useTodayStats();
  const { data: streak } = useCurrentStreak();

  if (loadingProfile || !profile) {
    return (
      <Screen variant="gradient">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.ink} />
        </View>
      </Screen>
    );
  }

  const quote = quoteForDay(new Date(), profile.timezone);

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <EditorialText kind="caps" color={palette.inkSoft}>
            {dateLabel(profile.timezone)}
          </EditorialText>
          <View style={styles.streakPill}>
            <EditorialText kind="bodySm" color={palette.peach}>
              🔥 {streak ?? 0}
            </EditorialText>
          </View>
        </View>

        <EditorialText kind="displayXl" style={styles.greeting}>
          Hi {profile.display_name}.
        </EditorialText>

        <QuoteCard
          quote={quote}
          nativeLang={profile.native_lang as SupportedLang}
        />

        <TodayProgress
          secondsSpoken={stats?.secondsSpoken ?? 0}
          dailyGoalMinutes={profile.daily_goal_minutes}
        />

        <Pressable
          style={styles.cta}
          onPress={() => router.push("/(tabs)/practice")}
          hitSlop={8}
        >
          <EditorialText
            kind="bodyLg"
            color={palette.peach}
            style={styles.ctaText}
          >
            ▸ Start practising
          </EditorialText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakPill: {
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minHeight: 28,
    justifyContent: "center",
  },
  greeting: { marginTop: spacing.sm },
  cta: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
    minHeight: 52,
  },
  ctaText: { fontWeight: "600" },
});
```

- [ ] **Step 2: Restyle `quote-card.tsx` as a GlassCard**

Replace its outer container with `<GlassCard padding="lg" radiusToken="lg">`. The quote text uses `<EditorialText kind="displayMd" italic>`, the attribution uses `<EditorialText kind="bodySm" color={palette.inkSoft}>`. The play / share row uses small icon buttons with `hitSlop: 12`.

- [ ] **Step 3: Replace `today-progress.tsx` bar with `<Ring>`**

Replace any progress bar with `<Ring progress={secondsSpoken / (dailyGoalMinutes*60)} size={64} label={\`\${minutes}′\`} />`. Render alongside a column with `<EditorialText kind="bodyMd">{minutes} of {dailyGoalMinutes} minutes</EditorialText>` and a subtitle "Keep going to hit today's goal" if goal not reached, "Goal hit ✿" if reached.

- [ ] **Step 4: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
cd app
git add "apps/mobile/app/(tabs)/home.tsx" "apps/mobile/src/features/home"
git commit -m "feat(home): re-skin Home + QuoteCard + TodayProgress per Sunrise mockup"
```

---

### Task 21: Re-skin Practice screen + redesign top status bar + MicButton

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/practice.tsx`
- Modify: `app/apps/mobile/src/features/practice/top-status-bar.tsx`
- Modify: `app/apps/mobile/src/features/practice/MessageBubble.tsx`
- Modify: `app/apps/mobile/src/features/practice/MicButton.tsx`

- [ ] **Step 1: Redesign `top-status-bar.tsx`**

The new layout has three regions:

- Left: timer pill `<GlassCard radiusToken="pill" padding="sm">` containing a 28×28 looping `LottieView` (source: `avatar.json`, autoPlay, loop=true), an `EditorialText kind="bodyMd"` showing `mm:ss`, and `EditorialText kind="bodySm" color={palette.inkSoft}` showing `/ goalMin:00`. Always rendered.
- Right: three glass circle buttons (32×32 visual, `hitSlop: 8` for ≥ 44px tap area):
  - Listening toggle (👂 / 🙉 icon)
  - Share button (existing `share-button.tsx` triggers the existing share logic)
  - Exit (✕)
- No background bar — the row floats over the gradient. `position: absolute, top: insets.top + 8, left: spacing.lg, right: spacing.lg`.

Use `useSafeAreaInsets()` from `react-native-safe-area-context`.

- [ ] **Step 2: Update `MessageBubble.tsx` to consume `<Bubble>`**

Replace any custom bubble JSX with `<Bubble variant={message.role === "coach" ? "coach" : "you"}>` wrapping the text + the existing repeat button (kept from Plan 6). Text uses `<EditorialText kind="bodyMd" color={...}>`. Listening mode reveal logic stays as-is.

- [ ] **Step 3: Restyle `MicButton.tsx`**

The mic button keeps its existing animation logic. Restyle:

- Idle: `backgroundColor: palette.ink`, mic icon in `palette.peach`, 72×72 circle, `...shadow.cta`
- Recording: `backgroundColor: palette.accent`, white pulse ring (existing logic)
- Busy: `backgroundColor: palette.glass`, spinner inside

- [ ] **Step 4: Rewrite `practice.tsx`**

Wrap return in `<Screen variant="gradient">`. Remove the `backgroundColor: "#ffffff"` style. The chat FlatList content style updates to use `palette.peach`-aware coloring (no white background). The error and loading states use the same Screen wrap + EditorialText for text. Confetti / goal-reward overlay stays untouched (redesigned in Task 27).

- [ ] **Step 5: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
cd app
git add "apps/mobile/app/(tabs)/practice.tsx" "apps/mobile/src/features/practice/top-status-bar.tsx" "apps/mobile/src/features/practice/MessageBubble.tsx" "apps/mobile/src/features/practice/MicButton.tsx"
git commit -m "feat(practice): re-skin Practice + redesign top status bar w/ corner Lottie"
```

---

### Task 22: Re-skin Progress screen + recolor heatmap + stats row

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/progress.tsx`
- Modify: `app/apps/mobile/src/features/progress/heatmap.tsx`
- Modify: `app/apps/mobile/src/features/progress/stats-row.tsx`

- [ ] **Step 1: Rewrite `progress.tsx`**

Wrap in `<Screen variant="gradient">`. Title uses `<EditorialText kind="displayLg">Progress</EditorialText>`. Streak chip uses the same `streakPill` pattern as Home. Section label uses `<EditorialText kind="caps" color={palette.inkSoft}>Last 12 weeks</EditorialText>`. Bottom padding 100 to clear the floating tab bar.

- [ ] **Step 2: Recolor `heatmap.tsx` cells**

Replace existing cell colors with four levels keyed off the coral accent:

- l0 (no practice): `palette.glassFaint`
- l1 (1-33% of goal): `rgba(217,107,91,0.25)`
- l2 (33-66%): `rgba(217,107,91,0.45)`
- l3 (66-99%): `rgba(217,107,91,0.7)`
- l4 (goal hit): `palette.accent`

The tap-cell handler still calls `Alert.alert` for now — Task 27 replaces it with the inline popover.

- [ ] **Step 3: Restyle `stats-row.tsx`**

Each stat card uses `<GlassCard padding="md">`. The big number uses `<EditorialText kind="displayMd">` with a small "min" suffix in `<EditorialText kind="bodySm" color={palette.inkSoft}>`. The label uses `<EditorialText kind="caps" color={palette.inkSoft}>`. Grid stays 2×2.

- [ ] **Step 4: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
cd app
git add "apps/mobile/app/(tabs)/progress.tsx" "apps/mobile/src/features/progress"
git commit -m "feat(progress): re-skin Progress + recolor heatmap with coral accent"
```

---

### Task 23: Re-skin Profile screen + profile-row

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/profile.tsx`
- Modify: `app/apps/mobile/src/features/profile/profile-row.tsx`

- [ ] **Step 1: Rewrite `profile.tsx`**

Wrap in `<Screen variant="gradient">`. Title uses `<EditorialText kind="displayLg">Profile</EditorialText>`. Section labels (`ACCOUNT`, `PLAN`) use `<EditorialText kind="caps" color={palette.inkSoft}>`. Each section is a `<GlassCard padding="sm">` containing `<ProfileRow>` children. Sign-out button: `backgroundColor: palette.dangerSurface`, `color: palette.danger`. Bottom padding 100.

Add a new ACCOUNT row for Email (between Display name and Native language):

```tsx
<ProfileRow
  label="Email"
  value={(profile as { email?: string }).email ?? ""}
  onPress={() => router.push("/(auth)/change-email")}
/>
```

The route `/(auth)/change-email` is created in Task 26.

- [ ] **Step 2: Restyle `profile-row.tsx`**

The row sits inside a `<GlassCard>` so it doesn't need its own background. Label uses `<EditorialText kind="bodyMd" color={palette.inkSoft}>`. Value uses `<EditorialText kind="bodyMd" color={palette.ink}>`. Chevron icon right-aligned. Min height = `touch.min`. Bottom separator: `borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.glassFaint` (omit on last row via prop).

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(tabs)/profile.tsx" "apps/mobile/src/features/profile/profile-row.tsx"
git commit -m "feat(profile): re-skin Profile with glass sections + Email row"
```

---

### Task 24: Re-skin edit sheets

**Files:**

- Modify: `app/apps/mobile/src/features/profile/edit-name-sheet.tsx`
- Modify: `app/apps/mobile/src/features/profile/edit-goal-sheet.tsx`
- Modify: `app/apps/mobile/src/features/profile/edit-language-sheet.tsx`

- [ ] **Step 1: Apply common sheet pattern to all three**

Each sheet:

- Sheet `backgroundStyle`: `{ backgroundColor: palette.peach, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }`
- Title row uses `<EditorialText kind="displayMd">`
- Inputs / pickers use `<GlassCard>` containers
- Save button uses the ink CTA pattern (`backgroundColor: palette.ink`, ink shadow, peach text)
- Per Plan 5 lesson: keep the `BottomSheetFooter` + `bottomInset` pattern for the save button to render reliably

Logic (save handlers, validation, Supabase calls) stays unchanged.

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add "apps/mobile/src/features/profile/edit-name-sheet.tsx" "apps/mobile/src/features/profile/edit-goal-sheet.tsx" "apps/mobile/src/features/profile/edit-language-sheet.tsx"
git commit -m "feat(profile): re-skin all 3 edit sheets in Sunrise palette"
```

---

### Task 25: Re-skin not-found screen

**Files:**

- Modify: `app/apps/mobile/app/+not-found.tsx`

- [ ] **Step 1: Apply branded 404 pattern**

```tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen variant="gradient">
      <EditorialText kind="displayXl" align="center" style={styles.title}>
        Lost in translation.
      </EditorialText>
      <EditorialText
        kind="bodyMd"
        color={palette.inkSoft}
        align="center"
        style={styles.body}
      >
        We couldn&apos;t find what you were looking for.
      </EditorialText>
      <Pressable
        style={styles.cta}
        onPress={() => router.replace("/(tabs)/home")}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          Take me home
        </EditorialText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing["3xl"] * 2, paddingHorizontal: spacing.xl },
  body: { marginTop: spacing.md, paddingHorizontal: spacing.xl },
  cta: {
    backgroundColor: palette.ink,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
});
```

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/app/+not-found.tsx
git commit -m "feat(mobile): re-skin not-found with editorial 404"
```

---

## Phase 8 — CHECKPOINT (manual device test)

> 🛑 **STOP for Bruno.** Trigger an EAS dev build, walk every screen:
>
> - Sign-out, walk through Welcome → sign-in → verify → onboarding (all 4) → land on Home
> - Home: greeting, quote, today-ring, CTA, streak pill
> - Practice: top status bar (corner Lottie + timer + icons), chat bubbles, mic button, end-session
> - Progress: heatmap (still uses Alert on tap — fine, gets fixed in Task 26), stats grid
> - Profile: avatar, all rows, edit each field via sheet
> - Floating tab bar across all tabs
> - Look for visual regressions
>
> If anything looks wrong, fix before proceeding.

```sh
cd app/apps/mobile
eas build --profile development --platform android
```

---

## Phase 9 — Features + polish (Batch D, 5 in parallel)

### Task 26: Email change flow

**Files:**

- Create: `app/apps/mobile/app/(auth)/change-email.tsx`

- [ ] **Step 1: Implement the change-email screen**

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

export default function ChangeEmail() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    if (!/.+@.+\..+/.test(email)) {
      showToast("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <Screen variant="gradient">
        <View style={styles.body}>
          <EditorialText kind="displayLg">Check your inbox.</EditorialText>
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.copy}
          >
            We sent a confirmation link to both your old and new email
            addresses. Click both to complete the change.
          </EditorialText>
          <Pressable style={styles.cta} onPress={() => router.back()}>
            <EditorialText kind="bodyLg" color={palette.peach}>
              Done
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="gradient">
      <View style={styles.body}>
        <EditorialText kind="displayLg">Change your email.</EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.copy}
        >
          We&apos;ll send a verification link to both your current and new
          address.
        </EditorialText>
        <GlassCard padding="md" style={styles.field}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="new@email.com"
            placeholderTextColor={palette.inkSoft}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </GlassCard>
        <Pressable
          style={[styles.cta, busy && styles.ctaBusy]}
          onPress={onSubmit}
          disabled={busy}
        >
          <EditorialText kind="bodyLg" color={palette.peach}>
            {busy ? "Sending…" : "Send confirmation"}
          </EditorialText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Cancel
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.base },
  copy: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  input: {
    ...typeTokens.bodyLg,
    color: palette.ink,
    padding: 0,
    minHeight: 24,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
  ctaBusy: { opacity: 0.7 },
  secondary: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
```

- [ ] **Step 2: Verify the Profile Email row from Task 23 routes here**

The Email `<ProfileRow>` added in Task 23 calls `router.push("/(auth)/change-email")`. This task's file makes that route resolve.

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(auth)/change-email.tsx"
git commit -m "feat(auth): add email change flow via Supabase updateUser"
```

---

### Task 27: Heatmap inline popover (replaces Alert.alert)

**Files:**

- Create: `app/apps/mobile/src/features/progress/heatmap-popover.tsx`
- Modify: `app/apps/mobile/src/features/progress/heatmap.tsx`

- [ ] **Step 1: Implement the popover component**

```tsx
import { Pressable, StyleSheet, View } from "react-native";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Props = {
  label: string;
  /** Anchor coordinates in the heatmap's coordinate space */
  anchor: { x: number; y: number };
  /** Screen width to clamp against (so right-edge cells don't overflow) */
  screenWidth: number;
  onDismiss: () => void;
};

const POPOVER_WIDTH = 180;

export function HeatmapPopover({
  label,
  anchor,
  screenWidth,
  onDismiss,
}: Props) {
  const left = Math.min(
    Math.max(spacing.md, anchor.x - POPOVER_WIDTH / 2),
    screenWidth - POPOVER_WIDTH - spacing.md,
  );
  const top = anchor.y - 56; // float above the cell

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View style={[styles.wrap, { top, left }]} pointerEvents="box-none">
        <GlassCard padding="md" radiusToken="md" strong style={styles.card}>
          <EditorialText kind="bodyMd" color={palette.ink}>
            {label}
          </EditorialText>
        </GlassCard>
        <View style={styles.tail} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", width: POPOVER_WIDTH, ...shadow.floating },
  card: { borderRadius: radius.md },
  tail: {
    position: "absolute",
    bottom: -6,
    left: POPOVER_WIDTH / 2 - 6,
    width: 12,
    height: 12,
    backgroundColor: palette.glassStrong,
    transform: [{ rotate: "45deg" }],
  },
});
```

- [ ] **Step 2: Wire popover into `heatmap.tsx`**

Replace the existing `Alert.alert` cell-tap handler with state-based popover rendering:

- Add `useState<{ label: string; anchor: { x: number; y: number } } | null>` for the active popover
- On cell press, capture the cell's screen-relative position via `onPress={(e) => setPopover({ label, anchor: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } })}`
- Render `<HeatmapPopover>` when popover state is set, with `onDismiss={() => setPopover(null)}`
- Get screen width from `useWindowDimensions()`

Label format unchanged from Plan 5: `"May 8 · 12 min · goal hit ✓"` or `"May 9 · no practice"`.

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/src/features/progress/heatmap-popover.tsx" "apps/mobile/src/features/progress/heatmap.tsx"
git commit -m "feat(progress): replace heatmap Alert with inline popover"
```

---

### Task 28: Offline Home quote

**Files:**

- Create: `app/apps/mobile/src/features/home/use-offline-quote.ts`
- Modify: `app/apps/mobile/app/(tabs)/home.tsx`

- [ ] **Step 1: Implement the hook**

```ts
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  quoteForDay,
  type DailyQuote,
  type SupportedLang,
} from "@language-coach/shared";

const STORAGE_KEY = "lc.offline-quote.v1";

type Cached = {
  date: string; // YYYY-MM-DD
  timezone: string;
  nativeLang: SupportedLang;
  quote: DailyQuote;
};

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

async function writeCache(value: Cached): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}

function isoDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
}

/**
 * Returns today's quote. If a profile is available, computes it live and writes
 * it to AsyncStorage. If no profile (e.g. offline first paint), reads the cache.
 */
export function useOfflineQuote(
  profile: { timezone: string; native_lang: string } | null | undefined,
): DailyQuote | null {
  const [quote, setQuote] = useState<DailyQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (profile) {
      const q = quoteForDay(new Date(), profile.timezone);
      setQuote(q);
      void writeCache({
        date: isoDate(profile.timezone),
        timezone: profile.timezone,
        nativeLang: profile.native_lang as SupportedLang,
        quote: q,
      });
    } else {
      void readCache().then((cached) => {
        if (cancelled || !cached) return;
        setQuote(cached.quote);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return quote;
}
```

`DailyQuote` and `SupportedLang` are already exported from `@language-coach/shared` (via `src/daily-quotes.ts` and `src/languages.ts`); no shared-package change needed.

- [ ] **Step 2: Update `home.tsx` to use the hook**

In the loading branch (when `loadingProfile`), instead of returning a blank spinner, attempt to render with the cached quote:

```tsx
const cachedQuote = useOfflineQuote(profile ?? null);

if (loadingProfile && !cachedQuote) {
  return (
    <Screen variant="gradient">
      <View style={styles.loading}>
        <ActivityIndicator color={palette.ink} />
      </View>
    </Screen>
  );
}

const quote = profile
  ? quoteForDay(new Date(), profile.timezone)
  : cachedQuote!;
```

The rest of the screen renders with the profile fallback values when offline (or you can render only the quote section + a "Connecting…" hint when no profile).

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/src/features/home/use-offline-quote.ts" "apps/mobile/app/(tabs)/home.tsx"
git commit -m "feat(home): cache + render today's quote offline"
```

---

### Task 29: Goal-reward redesign

**Files:**

- Modify: `app/apps/mobile/src/features/practice/goal-reward.tsx`

- [ ] **Step 1: Rewrite the celebration overlay**

Plan 6 ships confetti + sound. Plan 7 wraps the confetti in a Sunrise-tinted full-screen overlay with a Lottie + Fraunces callout.

```tsx
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useAudioPlayer } from "expo-audio";
import { EditorialText, FadeInView, Screen } from "@/src/design";
import { motion, palette, spacing } from "@language-coach/design-tokens";

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const player = useAudioPlayer(require("../../../assets/sounds/victory.mp3"));
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (!visible) return;
    void player.play();
    confettiRef.current?.start();
    const t = setTimeout(onHidden, 4000);
    return () => clearTimeout(t);
  }, [visible, player, onHidden]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Screen variant="gradient">
        <Pressable style={styles.overlay} onPress={onHidden}>
          <FadeInView style={styles.content}>
            <LottieView
              source={require("../../../assets/avatar.json")}
              autoPlay
              loop={false}
              style={styles.avatar}
            />
            <EditorialText
              kind="displayXl"
              italic
              align="center"
              style={styles.title}
            >
              ✿ Goal hit
            </EditorialText>
            <EditorialText
              kind="bodyLg"
              color={palette.inkSoft}
              align="center"
              style={styles.streak}
            >
              {streakDays}-day streak
            </EditorialText>
          </FadeInView>
        </Pressable>
        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          colors={[palette.accent, palette.coral, palette.peach, palette.mauve]}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center", padding: spacing.xl },
  avatar: { width: 200, height: 200 },
  title: { marginTop: spacing.md },
  streak: { marginTop: spacing.sm },
});
```

The component contract (`visible`, `streakDays`, `onHidden`) stays compatible with the existing call site in `practice.tsx`.

- [ ] **Step 2: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
cd app
git add apps/mobile/src/features/practice/goal-reward.tsx
git commit -m "feat(practice): redesign goal-reward with Lottie + Sunrise overlay"
```

---

### Task 30: Empty states (Practice + Progress)

**Files:**

- Modify: `app/apps/mobile/app/(tabs)/practice.tsx` (already touched by Task 21)
- Modify: `app/apps/mobile/app/(tabs)/progress.tsx` (already touched by Task 22)

- [ ] **Step 1: Practice empty state**

Replace the existing `<ListEmptyComponent>`:

```tsx
ListEmptyComponent={
  <View style={styles.emptyState}>
    <EditorialText kind="displayMd" italic align="center" color={palette.inkSoft}>
      Tap the mic to say hello.
    </EditorialText>
    <EditorialText
      kind="bodySm"
      align="center"
      color={palette.inkSoft}
      style={{ marginTop: spacing.md, opacity: 0.7 }}
    >
      Your coach is listening — just talk like you would to a friend.
    </EditorialText>
  </View>
}
```

- [ ] **Step 2: Progress empty state**

Inside `progress.tsx`, when `data.days.length === 0`:

```tsx
{
  isEmpty ? (
    <View style={styles.empty}>
      <EditorialText
        kind="displayMd"
        italic
        align="center"
        color={palette.inkSoft}
      >
        Your first day starts today.
      </EditorialText>
      <EditorialText
        kind="bodySm"
        align="center"
        color={palette.inkSoft}
        style={{ marginTop: spacing.md, opacity: 0.7 }}
      >
        Open Practice, talk for a minute, watch this fill in.
      </EditorialText>
    </View>
  ) : null;
}
```

(Replace the existing simple "Start practicing…" hint.)

- [ ] **Step 3: Verify typecheck**

```sh
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
cd app
git add "apps/mobile/app/(tabs)/practice.tsx" "apps/mobile/app/(tabs)/progress.tsx"
git commit -m "feat(mobile): editorial empty states for Practice + Progress"
```

---

## Phase 10 — Final verification + ship

### Task 31: Audit cleanup, re-run audit, EAS dev build, memory update

**Files:**

- Modify: `CLAUDE.md` (status note about Plan 7 being code-complete)

- [ ] **Step 1: Confirm touch targets pass**

Run the mobile audit:

```sh
python "C:\Users\bruno.moise\.claude\skills\mobile-design\scripts\mobile_audit.py" "C:\Users\bruno.moise\My Language Coach - rebuild\app\apps\mobile"
```

Expected: the four hard issues from the initial audit (touch target × 3 + AsyncStorage security) reduce to **one** — AsyncStorage remains as the explicit Plan 8 deferral.

If touch-target issues remain, locate the offending pressable in the named file and add `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` or increase the visual size to `touch.min` (44).

- [ ] **Step 2: Final typecheck across the workspace**

```sh
cd app
pnpm --filter mobile typecheck
pnpm --filter @language-coach/shared typecheck
pnpm --filter @language-coach/design-tokens typecheck
```

Expected: all PASS.

- [ ] **Step 3: Trigger EAS dev build**

```sh
cd app/apps/mobile
eas build --profile development --platform android
```

Wait for the build to complete; Bruno installs the APK on his device.

- [ ] **Step 4: Update `CLAUDE.md` with Plan 7 status**

In `CLAUDE.md`, update the Status section to reflect Plan 7 code-complete. Find:

```
Plans 1 + 2 + 3 + 4 + 5 + 6 are **done**. […]
```

Replace with:

```
Plans 1 + 2 + 3 + 4 + 5 + 6 + 7 are **done**. […]
```

And add a line after the Plan 6 description noting Plan 7's scope and HEAD ref. Update the "Plan 7 / Plan 8 pending" sentence to reflect only Plan 8 remaining.

- [ ] **Step 5: Final commit**

```sh
cd app
git add CLAUDE.md
git commit -m "chore: mark Plan 7 code-complete in CLAUDE.md"
```

- [ ] **Step 6: Walk-through on device with Bruno**

Final acceptance per spec section 14:

1. App icon on home screen is the legacy character mark ✓
2. Cold start shows intro Lottie on Sunrise gradient, ~1.8s ✓
3. Warm start skips intro ✓
4. Every screen renders in Sunrise + Fraunces + DM Sans ✓
5. Floating glass tab bar across all tabs ✓
6. In-session corner Lottie in Practice top bar + Lottie in goal-reward ✓
7. Heatmap inline popover replaces Alert.alert ✓
8. Profile Email row triggers change-email flow ✓
9. Home renders cached quote when offline ✓
10. Goal-reward fires the redesigned celebration ✓
11. Practice + Progress show editorial empty states ✓
12. Mobile audit reports zero touch-target + zero SafeArea issues ✓
13. No Plan 6 voice-loop regressions ✓

---

## Self-review summary (post-write)

**Spec coverage check** — every spec section has at least one task:

- §2 Design tokens → Task 1
- §3 Font loading → Task 15
- §4 Primitive layer → Tasks 6–13
- §5 Asset porting → Tasks 3, 4
- §6 Screen sweep → Tasks 16–25
- §7.1 Email change → Task 26
- §7.2 Heatmap popover → Task 27
- §7.3 Offline quote → Task 28
- §8.1 Goal-reward → Task 29
- §8.2 Empty states → Task 30
- §8.3 Header/top status bar → Task 21
- §9 Audit fixes → distributed (SafeArea via Screen primitive in Task 6, ErrorBoundary in Task 8, touch targets across screen tasks + cleanup in Task 31)
- §10 Order of work → mirrored in the phase structure above
- §11 Testing strategy → device-test checkpoints at Phases 6, 8, and 10

**Placeholder scan** — none. Every code block is complete; every screen sweep task names concrete files and gives concrete style/JSX guidance grounded in the design tokens defined in Task 1.

**Type consistency** — the `palette`, `radius`, `spacing`, `shadow`, `motion`, `type` tokens defined in Task 1 are referenced consistently across all subsequent tasks. The `Screen` variant prop (`gradient | solid | ink`) is consistent across all consumers. The `Bubble` variant prop (`coach | you`) matches the existing `ChatMessage.role` from Plan 6.

**Decomposition** — 31 tasks, each 2–10 minutes of mechanical work, with explicit parallel batches. Each commits independently. Two manual device-test checkpoints (Phases 6 and 8) before adding features and before shipping.
