# Plan 3 — Mobile + auth + onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bruno can install an Expo dev build on his Android device, sign in via email magic link, complete a 4-step onboarding wizard (name + native_lang + target_lang + daily_goal_minutes), and land on an empty Home tab. The whole tab structure (Home / Practice / Progress / Profile) exists as placeholders ready for Plans 4-6 to fill in.

**Architecture:** Expo SDK 54+ app with file-based routing (Expo Router). The root `_layout.tsx` is the only auth gate — it inspects the Supabase session and the `profiles` row, and Expo Router's group syntax handles redirects to `(auth)`, `(onboarding)`, or `(tabs)`. Auth is delegated to Supabase Auth using the publishable key. Server state via TanStack Query, client state via Zustand, styling via NativeWind. EAS Build produces an Android dev client APK that runs Metro over the network.

**Tech Stack:** Expo SDK 54+, TypeScript, Expo Router, `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `nativewind`, `@sentry/react-native`, `posthog-react-native`, `expo-secure-store`, `expo-notifications` (registration only — sending added in Plan 6).

**Working directory:** All paths in this plan are relative to `C:\Users\bruno.moise\My Language Coach - rebuild\app\` unless otherwise stated.

**Branch strategy:** Work directly on `main`. CI gates each merge.

**Spec reference:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md` §2 (file structure), §6 (mobile structure + auth flow + state management).

**Deliberate deviations from spec for v1:**

- **Email magic link only.** Apple + Google sign-in deferred to a later plan to avoid Apple/Google OAuth provider config friction blocking the initial dev-loop validation. Once the flow works on Bruno's Android device, social providers slot in cleanly.
- **No `expo-notifications` send pipeline yet.** Just register a token and store it. Cron + send happens in Plan 6.

---

## Pre-flight (manual, one-time, user-only)

Before any task runs, the user (Bruno) must complete:

1. **Android device prep**
   - Enable Developer Options on the phone (tap "Build number" 7× in Settings → About).
   - Enable USB Debugging in Developer Options.
   - (Optional but useful) Enable Wireless Debugging if you don't want to plug in.

2. **EAS CLI**
   - `npm install -g eas-cli` (or use via `npx eas-cli` ad-hoc — but global is smoother).
   - `eas login` — sign in as `bruno77176`. Verify with `eas whoami`.

3. **Supabase Auth — magic link configuration**
   - Supabase dashboard → Authentication → Providers → Email → confirm "Enable Email provider" is on AND "Confirm email" is off (or on, depending on UX preference — magic link works either way).
   - Authentication → Email Templates → Magic Link → confirm a template exists. Default works.
   - Authentication → URL Configuration → Site URL → set to your dev / prod URL. For dev, this can be `mylanguagecoach://verify`. Add `mylanguagecoach://verify` and any future URLs to Redirect URLs.
   - For production email delivery: Supabase free tier provides limited email sends (~30/hour, sent from a `noreply@mail.app.supabase.io`-style address). For real production scale, you'll wire up your own SMTP (Resend, Postmark, SES). Out of scope for Plan 3.

4. **Sentry + PostHog mobile projects**
   - Sentry: create a second project under your existing org for `language-coach-mobile`, platform "React Native". Save the DSN.
   - PostHog: create an account at https://posthog.com, create a project named `language-coach`. Save the API key.

5. **Provide secrets to the executor**
   - `SUPABASE_PUBLISHABLE_KEY` — already known from Plan 2.
   - `SUPABASE_URL` — already known.
   - `SENTRY_DSN_MOBILE` — new, from step 4.
   - `POSTHOG_API_KEY` — new, from step 4.
   - `POSTHOG_HOST` — usually `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU).

---

## Task 1: Scaffold Expo app

**Files:**

- Replace: `app/apps/mobile/*` (the Plan 1 placeholder)
- Create via Expo: `apps/mobile/app/`, `apps/mobile/assets/`, `apps/mobile/app.json`, etc.

- [ ] **Step 1: Remove the Plan 1 placeholder**

Run from `app/`:

```powershell
Remove-Item -Recurse -Force apps\mobile\*
```

- [ ] **Step 2: Scaffold a fresh Expo TypeScript app with Expo Router**

Run from `app/`:

```powershell
pnpm create expo-app apps/mobile --template tabs --no-install
```

The `--template tabs` template gives us Expo Router pre-wired with a tab layout. We'll restructure it heavily but it saves boilerplate.

`--no-install` because pnpm workspaces handles installs at root.

- [ ] **Step 3: Replace the generated `apps/mobile/package.json`**

The generated package.json uses `npm`. We need it as a workspace package and to align with our monorepo conventions. Read the generated file first to preserve dependency versions Expo picked, then update:

```json
{
  "name": "@language-coach/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "echo \"Mobile tests wired in later plans\" && exit 0"
  },
  "dependencies": {
    "(preserve everything generated)": "(preserve)"
  },
  "devDependencies": {
    "@language-coach/config": "workspace:*",
    "(preserve everything generated)": "(preserve)"
  }
}
```

After saving, run from `app/`:

```powershell
pnpm install
```

Expected: pnpm picks up the new workspace member, links `@language-coach/config`, installs all Expo deps.

- [ ] **Step 4: Verify scaffold works in isolation**

Run from `app/apps/mobile/`:

```powershell
pnpm typecheck
```

Expected: exits 0 (Expo's generated TS is strict-clean).

---

## Task 2: Wire workspace tooling (eslint, tsconfig, prettier)

**Files:**

- Create: `apps/mobile/eslint.config.mjs`
- Modify: `apps/mobile/tsconfig.json` (extend the workspace base)
- Add to: `apps/mobile/.gitignore` if needed (Expo generates one)

- [ ] **Step 1: Create `apps/mobile/eslint.config.mjs`**

```js
import config from "@language-coach/config/eslint";
export default config;
```

- [ ] **Step 2: Update `apps/mobile/tsconfig.json`**

Read the file first. The Expo template generates something like:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true }
}
```

We want to extend BOTH expo's tsconfig AND our workspace base. TypeScript supports an array of extends:

```json
{
  "extends": [
    "expo/tsconfig.base",
    "@language-coach/config/tsconfig.base.json"
  ],
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

If the array-extends doesn't work in TS 5.x for some reason, fall back to extending only `expo/tsconfig.base` and add the strict flags inline (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).

- [ ] **Step 3: Verify**

```powershell
pnpm -F @language-coach/mobile typecheck
pnpm -F @language-coach/mobile lint
```

Both exit 0.

---

## Task 3: Add core runtime deps

**Files:**

- Modify: `apps/mobile/package.json` (via `pnpm add`)

- [ ] **Step 1: Add Supabase + state + UI deps**

Run from `app/`:

```powershell
pnpm -F @language-coach/mobile add `
  @supabase/supabase-js `
  @tanstack/react-query `
  zustand `
  nativewind `
  @sentry/react-native `
  posthog-react-native
```

- [ ] **Step 2: Add Expo modules we need**

Use `expo install` to get versions compatible with the installed Expo SDK:

```powershell
pnpm -F @language-coach/mobile exec npx expo install `
  expo-secure-store `
  expo-notifications `
  expo-linking `
  expo-constants `
  expo-status-bar
```

`expo-secure-store` for the auth token, `expo-notifications` for push token registration (sending lands in Plan 6), `expo-linking` for the magic link deep-link handler, `expo-constants` for env-var access.

- [ ] **Step 3: Add NativeWind devDeps**

```powershell
pnpm -F @language-coach/mobile add -D tailwindcss@^3.4 prettier-plugin-tailwindcss
```

NativeWind v4 + Tailwind v3.x. Tailwind v4 is supported as of recent NativeWind but pin to v3 for stability.

- [ ] **Step 4: Verify**

```powershell
pnpm -F @language-coach/mobile typecheck
```

Exits 0.

---

## Task 4: Configure NativeWind

**Files:**

- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/nativewind-env.d.ts`
- Modify: `apps/mobile/babel.config.js`
- Modify: `apps/mobile/metro.config.js`
- Modify: `apps/mobile/tsconfig.json` to include nativewind types

- [ ] **Step 1: Create `apps/mobile/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 2: Create `apps/mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Create `apps/mobile/nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 4: Update `apps/mobile/babel.config.js`**

Read the existing file (Expo generates one). Add NativeWind preset:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5: Update `apps/mobile/metro.config.js`**

Wrap with NativeWind:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Verify NativeWind works**

In any screen, add `<View className="flex-1 items-center justify-center bg-white">` and confirm typecheck passes.

```powershell
pnpm -F @language-coach/mobile typecheck
```

We can't visually verify yet (need a build). That happens in Task 14.

---

## Task 5: Env config (Supabase URL + keys, Sentry, PostHog)

**Files:**

- Modify: `apps/mobile/app.config.ts` (or `app.json` → convert to TS)
- Create: `apps/mobile/src/lib/env.ts`
- Create: `apps/mobile/.env.example`
- Update: `apps/mobile/.gitignore` to exclude `.env*` if not already

- [ ] **Step 1: Convert `app.json` to `app.config.ts`** for env-var injection

Read the generated `app.json`. Create `apps/mobile/app.config.ts`:

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
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.brunomoise.mylanguagecoach",
  },
  android: {
    package: "com.anonymous.mylanguagecoach",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
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

The Android `package` matches the legacy Play Store listing (`com.anonymous.mylanguagecoach`). The iOS `bundleIdentifier` matches the legacy iOS app.

Then delete `app.json`.

- [ ] **Step 2: Create `apps/mobile/src/lib/env.ts`**

```ts
import Constants from "expo-constants";
import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SENTRY_DSN_MOBILE: z.string().url(),
  POSTHOG_API_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

const raw = Constants.expoConfig?.extra ?? {};
const result = EnvSchema.safeParse(raw);

if (!result.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid mobile env config:", result.error.format());
  throw new Error(
    "Mobile env config is missing or invalid — check app.config.ts and .env",
  );
}

export const env: Env = result.data;
```

`zod` isn't in mobile's deps yet. Add it:

```powershell
pnpm -F @language-coach/mobile add zod
```

- [ ] **Step 3: Create `apps/mobile/.env.example`**

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR-KEY
SENTRY_DSN_MOBILE=https://YOUR-DSN@oNNN.ingest.sentry.io/NNN
POSTHOG_API_KEY=phc_YOUR-KEY
POSTHOG_HOST=https://us.i.posthog.com
EAS_PROJECT_ID=will-be-set-by-eas-init-in-task-13
```

- [ ] **Step 4: Verify .gitignore covers `.env*`** (Expo's default does).

---

## Task 6: Supabase client + TanStack Query provider

**Files:**

- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/lib/query-client.ts`

- [ ] **Step 1: Create `apps/mobile/src/lib/supabase.ts`**

```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

Two deps to install:

```powershell
pnpm -F @language-coach/mobile add react-native-url-polyfill @react-native-async-storage/async-storage
```

`react-native-url-polyfill` is required by `@supabase/supabase-js` on RN. AsyncStorage stores the session.

(We use AsyncStorage for the session, not SecureStore. Supabase's docs recommend AsyncStorage; SecureStore has size limits that bite for refresh tokens. The session JWT itself isn't dramatically sensitive — RLS gates everything server-side.)

- [ ] **Step 2: Create `apps/mobile/src/lib/query-client.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s
      gcTime: 5 * 60 * 1000, // 5 min
      retry: 2,
      refetchOnWindowFocus: false, // RN: window focus is meaningful, but TanStack defaults are too aggressive on mobile
      refetchOnReconnect: true,
    },
  },
});
```

---

## Task 7: Auth state store (Zustand)

**Files:**

- Create: `apps/mobile/src/features/auth/auth-store.ts`
- Create: `apps/mobile/src/features/auth/auth-store.test.ts`

- [ ] **Step 1: Write the failing test first**

`apps/mobile/src/features/auth/auth-store.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useAuthStore } from "./auth-store";

describe("auth-store", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, status: "loading" });
  });

  it("starts in loading status", () => {
    expect(useAuthStore.getState().status).toBe("loading");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("setSession updates session and flips status to authenticated", () => {
    const fakeSession = { user: { id: "user-123" } };
    useAuthStore.getState().setSession(fakeSession as never);
    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("setSession(null) flips status to anonymous", () => {
    useAuthStore.getState().setSession({ user: { id: "x" } } as never);
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});
```

This requires Vitest in the mobile package. Add it:

```powershell
pnpm -F @language-coach/mobile add -D vitest
```

And update `apps/mobile/package.json` test script: `"test": "vitest run"`.

- [ ] **Step 2: Confirm fail.** `pnpm -F @language-coach/mobile test`

- [ ] **Step 3: Create `apps/mobile/src/features/auth/auth-store.ts`**

```ts
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthState = {
  session: Session | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: "loading",
  setSession: (session) =>
    set({
      session,
      status: session ? "authenticated" : "anonymous",
    }),
}));
```

- [ ] **Step 4: Re-run tests, expect pass.**

---

## Task 8: Root layout — auth gate + providers

**Files:**

- Replace: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Replace `apps/mobile/app/_layout.tsx`**

```tsx
import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/src/lib/supabase";
import { queryClient } from "@/src/lib/query-client";
import { useAuthStore } from "@/src/features/auth/auth-store";

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    // Initial session probe
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Subscribe to subsequent changes (sign-in, sign-out, token refresh)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => data.subscription.unsubscribe();
  }, [setSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Create `apps/mobile/app/index.tsx`** — the gate that decides where to send the user

```tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { useProfile } from "@/src/features/auth/use-profile";

export default function IndexGate() {
  const status = useAuthStore((s) => s.status);
  const { data: profile, isLoading } = useProfile();

  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (status === "anonymous") {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile) {
    return <Redirect href="/(onboarding)/name" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
```

- [ ] **Step 3: Create `apps/mobile/src/features/auth/use-profile.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "./auth-store";

export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
```

`maybeSingle` returns `null` if no row (vs `single` which throws). For new users post-sign-up, no profile row exists yet — `null` is the signal to redirect to onboarding.

- [ ] **Step 4: Verify typecheck**

```powershell
pnpm -F @language-coach/mobile typecheck
```

---

## Task 9: Sign-in screen (email magic link)

**Files:**

- Replace: anything generated under `apps/mobile/app/(auth)/`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Create `apps/mobile/app/(auth)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `apps/mobile/app/(auth)/sign-in.tsx`**

```tsx
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { supabase } from "@/src/lib/supabase";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: "mylanguagecoach://verify" },
    });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send the link", error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="mb-4 text-2xl font-semibold">Check your email</Text>
        <Text className="text-center text-gray-600">
          We sent a magic link to {email}. Tap it on this device to sign in.
        </Text>
        <TouchableOpacity
          className="mt-8"
          onPress={() => {
            setSent(false);
            setEmail("");
          }}
        >
          <Text className="text-blue-600">Use a different email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-8 text-center text-3xl font-bold">
        My Language Coach
      </Text>
      <Text className="mb-2 text-base font-medium">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        className="rounded-lg border border-gray-300 p-4 text-base"
      />
      <TouchableOpacity
        onPress={onSubmit}
        disabled={sending || !email.trim()}
        className={`mt-6 rounded-lg p-4 ${
          sending || !email.trim() ? "bg-gray-300" : "bg-blue-600"
        }`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {sending ? "Sending…" : "Send magic link"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Task 10: Magic link deep-link handler

**Files:**

- Create: `apps/mobile/app/(auth)/verify.tsx`

The magic link URL has the form `mylanguagecoach://verify#access_token=…&refresh_token=…&type=magiclink`. Supabase's `getSessionFromUrl` handles parsing.

- [ ] **Step 1: Create `apps/mobile/app/(auth)/verify.tsx`**

```tsx
import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";

export default function VerifyScreen() {
  useEffect(() => {
    const consume = async (url: string) => {
      // The URL has #access_token=... in the fragment.
      // Supabase v2 helper accepts the full URL.
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error || !data.session) {
        // Fallback: parse hash params manually if exchangeCodeForSession can't.
        // For magic links, sometimes the URL contains tokens as fragment params.
        const parsed = Linking.parse(url);
        const { access_token, refresh_token } = (parsed.queryParams ?? {}) as {
          access_token?: string;
          refresh_token?: string;
        };
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!setErr) {
            router.replace("/");
            return;
          }
        }
        router.replace("/(auth)/sign-in");
        return;
      }
      router.replace("/");
    };

    Linking.getInitialURL().then((url) => {
      if (url) void consume(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => void consume(url));
    return () => sub.remove();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-gray-600">Signing you in…</Text>
    </View>
  );
}
```

After the session is set, the auth store's listener (Task 8) picks it up and the index gate (`app/index.tsx`) redirects to onboarding or tabs.

---

## Task 11: Onboarding wizard (4 steps)

**Files:**

- Create: `apps/mobile/app/(onboarding)/_layout.tsx`
- Create: `apps/mobile/app/(onboarding)/name.tsx`
- Create: `apps/mobile/app/(onboarding)/native-lang.tsx`
- Create: `apps/mobile/app/(onboarding)/target-lang.tsx`
- Create: `apps/mobile/app/(onboarding)/daily-goal.tsx`
- Create: `apps/mobile/src/features/onboarding/onboarding-store.ts`
- Create: `apps/mobile/src/features/onboarding/use-complete-onboarding.ts`
- Create: `packages/shared/src/languages.ts` — populate from spec, used by both onboarding screens

- [ ] **Step 1: Populate `packages/shared/src/languages.ts`** (replaces the placeholder export)

```ts
export type Language = {
  code: string; // ISO 639-1
  englishName: string;
  nativeName: string;
  flag: string; // emoji
};

export const LANGUAGES: ReadonlyArray<Language> = [
  { code: "en", englishName: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "fr", englishName: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", englishName: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", englishName: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "es", englishName: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  {
    code: "pt",
    englishName: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
  },
  { code: "tr", englishName: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "sv", englishName: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "da", englishName: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "ru", englishName: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ro", englishName: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "hu", englishName: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
];
```

Update `packages/shared/src/index.ts`:

```ts
export { identity } from "./identity";
export * from "./languages";
```

(Keep identity for now; remove in a later plan when nothing else uses it.)

- [ ] **Step 2: Create `apps/mobile/src/features/onboarding/onboarding-store.ts`**

```ts
import { create } from "zustand";

type OnboardingState = {
  displayName: string;
  nativeLang: string;
  targetLang: string;
  dailyGoalMinutes: number;
  setDisplayName: (v: string) => void;
  setNativeLang: (v: string) => void;
  setTargetLang: (v: string) => void;
  setDailyGoalMinutes: (v: number) => void;
  reset: () => void;
};

const initial = {
  displayName: "",
  nativeLang: "",
  targetLang: "",
  dailyGoalMinutes: 10,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setDisplayName: (displayName) => set({ displayName }),
  setNativeLang: (nativeLang) => set({ nativeLang }),
  setTargetLang: (targetLang) => set({ targetLang }),
  setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
  reset: () => set(initial),
}));
```

- [ ] **Step 3: Create `apps/mobile/src/features/onboarding/use-complete-onboarding.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useOnboardingStore } from "./onboarding-store";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const reset = useOnboardingStore((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      const { displayName, nativeLang, targetLang, dailyGoalMinutes } =
        useOnboardingStore.getState();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_display_name: displayName,
        p_native_lang: nativeLang,
        p_target_lang: targetLang,
        p_daily_goal_minutes: dailyGoalMinutes,
        p_timezone: timezone,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      reset();
    },
  });
}
```

- [ ] **Step 4: Create `apps/mobile/app/(onboarding)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Create the 4 step screens**

`apps/mobile/app/(onboarding)/name.tsx`:

```tsx
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

export default function NameStep() {
  const initial = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const [value, setValue] = useState(initial);

  const onNext = () => {
    if (!value.trim()) return;
    setDisplayName(value.trim());
    router.push("/(onboarding)/native-lang");
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-2 text-3xl font-bold">What's your name?</Text>
      <Text className="mb-6 text-gray-600">
        Your coach will use this to greet you.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Your first name"
        autoCapitalize="words"
        className="rounded-lg border border-gray-300 p-4 text-base"
      />
      <TouchableOpacity
        onPress={onNext}
        disabled={!value.trim()}
        className={`mt-6 rounded-lg p-4 ${value.trim() ? "bg-blue-600" : "bg-gray-300"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          Next
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

`apps/mobile/app/(onboarding)/native-lang.tsx`:

```tsx
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

export default function NativeLangStep() {
  const selected = useOnboardingStore((s) => s.nativeLang);
  const setNativeLang = useOnboardingStore((s) => s.setNativeLang);

  return (
    <View className="flex-1 bg-white">
      <View className="px-6 pt-12">
        <Text className="mb-2 text-3xl font-bold">Your native language?</Text>
        <Text className="mb-6 text-gray-600">Used for translations.</Text>
      </View>
      <ScrollView className="flex-1 px-6">
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setNativeLang(lang.code)}
              className={`mb-2 flex-row items-center rounded-lg border p-4 ${
                isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              <Text className="mr-3 text-2xl">{lang.flag}</Text>
              <View className="flex-1">
                <Text className="text-base font-medium">
                  {lang.englishName}
                </Text>
                <Text className="text-sm text-gray-500">{lang.nativeName}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View className="border-t border-gray-100 bg-white p-6">
        <TouchableOpacity
          onPress={() => router.push("/(onboarding)/target-lang")}
          disabled={!selected}
          className={`rounded-lg p-4 ${selected ? "bg-blue-600" : "bg-gray-300"}`}
        >
          <Text className="text-center text-base font-semibold text-white">
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

`apps/mobile/app/(onboarding)/target-lang.tsx`: same as native-lang but reads/writes `targetLang` and pushes to `/(onboarding)/daily-goal`. Header text: "What language do you want to learn?".

`apps/mobile/app/(onboarding)/daily-goal.tsx`:

```tsx
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useCompleteOnboarding } from "@/src/features/onboarding/use-complete-onboarding";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

const GOAL_OPTIONS = [3, 5, 10, 15, 20];

export default function DailyGoalStep() {
  const initial = useOnboardingStore((s) => s.dailyGoalMinutes);
  const setDailyGoalMinutes = useOnboardingStore((s) => s.setDailyGoalMinutes);
  const [selected, setSelected] = useState(initial);
  const mutation = useCompleteOnboarding();

  const onFinish = async () => {
    setDailyGoalMinutes(selected);
    try {
      await mutation.mutateAsync();
      // The auth store + profile query will detect the new profile and the
      // root index gate redirects to /(tabs)/home automatically.
    } catch (err) {
      Alert.alert("Couldn't complete onboarding", String(err));
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-2 text-3xl font-bold">Daily practice goal</Text>
      <Text className="mb-6 text-gray-600">How many minutes per day?</Text>
      {GOAL_OPTIONS.map((m) => {
        const isSelected = selected === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => setSelected(m)}
            className={`mb-2 rounded-lg border p-4 ${
              isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200"
            }`}
          >
            <Text className="text-base font-medium">{m} minutes</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onFinish}
        disabled={mutation.isPending}
        className={`mt-6 rounded-lg p-4 ${mutation.isPending ? "bg-gray-300" : "bg-blue-600"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {mutation.isPending ? "Setting up…" : "Start practicing"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Task 12: Tabs scaffolding (placeholders)

**Files:**

- Replace: anything generated under `apps/mobile/app/(tabs)/`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/home.tsx`
- Create: `apps/mobile/app/(tabs)/practice.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/progress.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create `apps/mobile/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubble-ellipses-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

`@expo/vector-icons` is included in Expo by default; no additional install.

- [ ] **Step 2: Create `apps/mobile/app/(tabs)/home.tsx`**

```tsx
import { Text, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";

export default function HomeScreen() {
  const { data: profile } = useProfile();
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="mb-2 text-2xl font-bold">
        Hi {profile?.display_name ?? "there"} 👋
      </Text>
      <Text className="text-gray-600">
        Your home screen will live here. Practice flow comes in Plan 4.
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Create the other 3 tab placeholders** — same pattern with appropriate placeholder text.

- [ ] **Step 4: Profile tab — add sign-out**

`apps/mobile/app/(tabs)/profile.tsx`:

```tsx
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";

export default function ProfileScreen() {
  const { data: profile } = useProfile();

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to see your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white p-6">
      <Text className="mb-1 text-3xl font-bold">{profile?.display_name}</Text>
      <Text className="mb-8 text-gray-600">
        Native: {profile?.native_lang} · Learning: {profile?.target_lang} ·
        Goal: {profile?.daily_goal_minutes}min/day
      </Text>
      <TouchableOpacity
        onPress={onSignOut}
        className="rounded-lg bg-red-100 p-4"
      >
        <Text className="text-center text-base font-semibold text-red-700">
          Sign out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

(Editing the profile is left for Plan 5. This is read-only + sign-out.)

---

## Task 13: Configure EAS

**Files:**

- Create: `apps/mobile/eas.json`

- [ ] **Step 1: Initialize EAS project**

Run from `app/apps/mobile/`:

```powershell
eas init
```

Follow the prompts. This creates an EAS project ID and stores it. Add it to `apps/mobile/.env`:

```
EAS_PROJECT_ID=<the-uuid-from-eas-init>
```

Also add to your local `apps/mobile/.env` (create if missing) with the other secrets from Pre-flight.

- [ ] **Step 2: Create `apps/mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "SUPABASE_URL": "https://nzrrqykcloanoaqwbexv.supabase.co",
        "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_02kfSiKQsU_hhoCQ4imRig_vTVsWY0m"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

The `env` block in the `development` profile inlines the public Supabase config so the dev build works without us manually setting env vars on every build. The Sentry/PostHog DSNs are added to EAS secrets (not env, because they're more sensitive — though the mobile DSN isn't really a secret, it's bundle-readable):

```powershell
eas env:create --scope project --name SENTRY_DSN_MOBILE --value "https://2441378aa3508ef04734add3d7c4c447@o4511359436783616.ingest.de.sentry.io/<MOBILE-PROJECT-ID>" --visibility plaintext
eas env:create --scope project --name POSTHOG_API_KEY --value "phc_..." --visibility sensitive
eas env:create --scope project --name POSTHOG_HOST --value "https://us.i.posthog.com" --visibility plaintext
```

(Replace the DSN/keys with the real ones from Pre-flight step 4.)

---

## Task 14: First Android dev build + install on Bruno's device

**Files:** none new — pure ops.

- [ ] **Step 1: Build the dev client**

Run from `app/apps/mobile/`:

```powershell
eas build --profile development --platform android
```

Wait ~15-20 min for EAS Build queue + actual build. The output ends with a download URL for the APK.

- [ ] **Step 2: Install the APK on Bruno's Android device**

Two options:

(a) Open the URL on the phone's browser (Chrome) → download → "Install from unknown sources" prompt → install.

(b) Download the APK to the laptop, transfer to phone via USB or `adb install path/to/app.apk`.

- [ ] **Step 3: Open the dev client + start Metro**

On the phone, open the newly installed "My Language Coach (Development)" app. It shows a screen to enter the Metro URL.

On the laptop, from `apps/mobile/`:

```powershell
pnpm start
```

Expo's CLI prints a QR code + a `exp://192.168.x.x:8081` URL. Either scan the QR or enter the URL in the dev client.

The app should load. You see the sign-in screen.

- [ ] **Step 4: Walk the full flow**

1. Enter your email, tap "Send magic link".
2. Open your inbox on the phone, tap the link.
3. App opens to /verify, signs you in, redirects to /(onboarding)/name.
4. Fill in name, native lang, target lang, daily goal.
5. Tap "Start practicing" — calls `complete_onboarding`, lands on Home.
6. Verify in Supabase Table Editor that `profiles` and `entitlements` rows exist for your user.
7. Test sign-out from Profile tab → returns to sign-in screen.

If anything breaks, fix in code, save, watch Metro hot-reload.

---

## Task 15: Lint, format, test, commit, push, verify CI

- [ ] **Step 1: Run the full pipeline**

From `app/`:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Fix any failures. The mobile package's tests should run via vitest (auth-store test from Task 7 should pass).

- [ ] **Step 2: Commit**

```powershell
git add .
git commit -m @'
feat(mobile): scaffold Expo app with magic link auth + onboarding (Plan 3)

- Expo SDK 54+ with Expo Router file-based routing
- TypeScript strict, NativeWind styling, Zustand for client state,
  TanStack Query for server state
- Supabase Auth (email magic link) with deep-link verify handler
- Auth gate in app/index.tsx redirects: anonymous → sign-in,
  authed-no-profile → onboarding, authed-with-profile → home
- 4-step onboarding wizard (name, native lang, target lang, daily goal)
  calls complete_onboarding RPC for atomic profile + entitlement insert
- 4-tab placeholder structure (home, practice, progress, profile)
- EAS dev build profile for Android (apk, internal distribution)
- Apple/Google sign-in deferred — magic link only for v1

Refs: docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md (Plan 3 of 7)
'@
git push
```

- [ ] **Step 3: Verify CI green**

```powershell
gh run watch --repo bruno77176/my-language-coach-agentical-rebuild
```

Mobile tests (just the auth-store test for now) run alongside api tests.

---

## Plan completion checklist

- [ ] Bruno can install the dev APK and walk the full flow on his Android device.
- [ ] After completing onboarding, `profiles` and `entitlements` rows exist in Supabase for his user (visible in Table Editor).
- [ ] Sign-out from the Profile tab returns the user to the sign-in screen.
- [ ] Re-signing-in returns straight to the Home tab (no onboarding repeat).
- [ ] Local pipeline (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`) all green.
- [ ] CI green on the latest `main` commit.

---

## What's deliberately NOT in Plan 3

- **No Sign in with Apple / Google.** Email magic link only.
- **No Sentry / PostHog SDK initialization in code yet.** Plan 6 wires them up alongside push notifications and freemium analytics events. Their config is in app.config.ts so they're ready to plug in.
- **No push notifications send pipeline.** Token registration also deferred to Plan 6.
- **No iOS dev build.** Android first; iOS dev build can be added at any time with `eas build --profile development --platform ios` once Apple Dev account is verified.
- **No Maestro E2E tests.** Plan 7.
- **No real Practice / Progress screens.** Tabs are placeholders; real content in Plans 4-5.
- **No profile editing.** The profile tab is read-only + sign-out for now.
