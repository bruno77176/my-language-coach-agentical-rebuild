# Auth: social sign-in + password reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google + Apple sign-in, password recovery via email magic link, and account linking; replace the fragile sign-in/sign-up auto-fallback with explicit modes.

**Architecture:** Use Supabase's native ID-token flow (`signInWithIdToken`) with `@react-native-google-signin/google-signin` and `expo-apple-authentication` for native SDKs — no browser bounce. Password reset uses Supabase's `resetPasswordForEmail` with a deep link back into the app, mirroring the pattern already in `verify.tsx`. Account linking happens via Supabase's "auto-link identities by verified email" dashboard setting — no app-side merge code.

**Tech Stack:** Expo SDK 54, Supabase JS v2, `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `expo-crypto` (for Apple nonce hashing), `@gorhom/bottom-sheet`, zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-05-25-auth-social-and-password-reset-design.md`

**Working directory for all commands:** `app/apps/mobile/` unless otherwise noted.

---

## Task 1: Install native deps + wire app.config + env schema

Sets up everything the social providers need at the native and config layer. No new feature behavior yet — this task just makes the app build with the new dependencies.

**Files:**

- Modify: `app/apps/mobile/package.json` (via `npx expo install`)
- Modify: `app/apps/mobile/app.config.ts`
- Modify: `app/apps/mobile/src/lib/env.ts`
- Modify: `app/.env.example` (if it exists; otherwise document in README)

- [ ] **Step 1: Install Google sign-in, Apple auth, and crypto packages**

From `app/apps/mobile/`:

```bash
npx expo install @react-native-google-signin/google-signin expo-apple-authentication expo-crypto
```

Use `npx expo install` (not `pnpm add`) per the CLAUDE.md lesson — it picks SDK-compatible versions and avoids duplicate native modules.

- [ ] **Step 2: Verify no duplicates were introduced**

```bash
npx expo-doctor
```

Expected: all checks pass. If a duplicate `react-native-reanimated` or similar shows up, fix per the recipe in `CLAUDE.md` (nuke `node_modules`, `pnpm install`, remove stray workspace-root copies).

- [ ] **Step 3: Add Google plugin + Apple capability + env vars to `app.config.ts`**

Edit `app/apps/mobile/app.config.ts`:

```ts
import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "My Language Coach",
  slug: "my-language-coach",
  scheme: "mylanguagecoach",
  version: "2.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-transparent.png",
    resizeMode: "contain",
    backgroundColor: "#fde7d1",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.brunomoise.mylanguagecoach",
    buildNumber: "6",
    usesAppleSignIn: true,
    infoPlist: {
      NSMicrophoneUsageDescription:
        "We use the microphone so you can talk to your coach.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.anonymous.mylanguagecoach",
    versionCode: 40,
    permissions: ["RECORD_AUDIO"],
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
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME,
      },
    ],
  ],
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SENTRY_DSN_MOBILE: process.env.SENTRY_DSN_MOBILE,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
    GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
    eas: {
      projectId: "730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
    },
  },
});
```

Note: `GOOGLE_IOS_URL_SCHEME` is the reversed iOS client ID (e.g., `com.googleusercontent.apps.123456789-abc`). The Google plugin uses it to register a URL scheme so iOS can return from the Google sign-in sheet.

- [ ] **Step 4: Add new env vars to the zod schema in `env.ts`**

Edit `app/apps/mobile/src/lib/env.ts`:

```ts
import Constants from "expo-constants";
import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SENTRY_DSN_MOBILE: z.string().url(),
  POSTHOG_API_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
  GOOGLE_WEB_CLIENT_ID: z.string().min(1),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

const raw = Constants.expoConfig?.extra ?? {};
const result = EnvSchema.safeParse(raw);

if (!result.success) {
  console.error("Invalid mobile env config:", result.error.format());
  throw new Error(
    "Mobile env config is missing or invalid — check app.config.ts and .env",
  );
}

export const env: Env = result.data;
```

- [ ] **Step 5: Run typecheck to confirm the config compiles**

From `app/apps/mobile/`:

```bash
pnpm typecheck
```

Expected: no errors. (The env values will be `undefined` at this point because `.env` hasn't been updated — that's expected. The schema will throw at runtime once the app launches, which is handled in Step 6.)

- [ ] **Step 6: Hand-off note — Bruno must update `.env` and rebuild dev client**

This task introduces native modules. Add these three vars to `app/apps/mobile/.env` (and to EAS secrets for production):

```
GOOGLE_WEB_CLIENT_ID=<from Google Cloud Console — "Web application" OAuth client ID>
GOOGLE_IOS_CLIENT_ID=<from Google Cloud Console — "iOS" OAuth client ID>
GOOGLE_IOS_URL_SCHEME=<reversed GOOGLE_IOS_CLIENT_ID, e.g. com.googleusercontent.apps.123-abc>
```

Then rebuild the dev client:

```bash
eas build --profile development --platform android
```

(Skip the manual handoff steps if the agent has been told Bruno has already set the env + rebuilt. Otherwise, surface this to him before proceeding to Task 2.)

- [ ] **Step 7: Commit**

```bash
git add app/apps/mobile/package.json app/apps/mobile/app.config.ts app/apps/mobile/src/lib/env.ts pnpm-lock.yaml
git commit -m "feat(auth): install Google + Apple sign-in native deps and config"
```

---

## Task 2: Create `social-sign-in` module with tests

Wraps Google + Apple native SDK calls + Supabase `signInWithIdToken` behind a uniform API. Pure logic — unit-testable with vitest mocks.

**Files:**

- Create: `app/apps/mobile/src/features/auth/social-sign-in.ts`
- Create: `app/apps/mobile/src/features/auth/social-sign-in.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/apps/mobile/src/features/auth/social-sign-in.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  },
}));

vi.mock("expo-apple-authentication", () => ({
  signInAsync: vi.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: vi.fn().mockResolvedValue(true),
}));

vi.mock("expo-crypto", () => ({
  digestStringAsync: vi.fn().mockResolvedValue("hashed-nonce"),
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { HEX: "HEX" },
  randomUUID: () => "raw-nonce",
}));

vi.mock("@/src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: vi.fn(),
    },
  },
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    GOOGLE_WEB_CLIENT_ID: "test-web-client",
    GOOGLE_IOS_CLIENT_ID: "test-ios-client",
  },
}));

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "@/src/lib/supabase";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
  SocialSignInError,
} from "./social-sign-in";

describe("signInWithGoogle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the ID token to Supabase and returns the session", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: "google-id-token" },
    });
    const fakeSession = { user: { id: "u1" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });

    const session = await signInWithGoogle();

    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "google-id-token",
    });
    expect(session).toBe(fakeSession);
  });

  it("throws SocialSignInCancelled when the user cancels", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "SIGN_IN_CANCELLED",
    });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(
      SocialSignInCancelled,
    );
  });

  it("throws SocialSignInError when Google returns no ID token", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: null },
    });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SocialSignInError);
  });

  it("throws SocialSignInError when Supabase rejects the token", async () => {
    (GoogleSignin.signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { idToken: "google-id-token" },
    });
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: null }, error: { message: "bad" } });
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SocialSignInError);
  });
});

describe("signInWithApple", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashes the nonce and passes raw nonce + identity token to Supabase", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ identityToken: "apple-id-token" });
    const fakeSession = { user: { id: "u2" } };
    (
      supabase.auth.signInWithIdToken as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: { session: fakeSession }, error: null });

    const session = await signInWithApple();

    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: "hashed-nonce" }),
    );
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "raw-nonce",
    });
    expect(session).toBe(fakeSession);
  });

  it("throws SocialSignInCancelled when the user cancels", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    await expect(signInWithApple()).rejects.toBeInstanceOf(
      SocialSignInCancelled,
    );
  });

  it("throws SocialSignInError when Apple returns no identity token", async () => {
    (
      AppleAuthentication.signInAsync as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ identityToken: null });
    await expect(signInWithApple()).rejects.toBeInstanceOf(SocialSignInError);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
pnpm test -- social-sign-in
```

Expected: all tests fail with "cannot resolve module './social-sign-in'" or similar.

- [ ] **Step 3: Implement the module**

Create `app/apps/mobile/src/features/auth/social-sign-in.ts`:

```ts
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/src/lib/supabase";
import { env } from "@/src/lib/env";

export class SocialSignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled");
    this.name = "SocialSignInCancelled";
  }
}

export class SocialSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialSignInError";
  }
}

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<Session> {
  configureGoogle();
  let result;
  try {
    await GoogleSignin.hasPlayServices();
    result = await GoogleSignin.signIn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SocialSignInCancelled();
    }
    throw new SocialSignInError(
      (err as Error)?.message ?? "Google sign-in failed",
    );
  }

  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new SocialSignInError("Google did not return an ID token");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error || !data.session) {
    throw new SocialSignInError(
      error?.message ?? "Supabase rejected the token",
    );
  }
  return data.session;
}

export async function signInWithApple(): Promise<Session> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ERR_REQUEST_CANCELED") {
      throw new SocialSignInCancelled();
    }
    throw new SocialSignInError(
      (err as Error)?.message ?? "Apple sign-in failed",
    );
  }

  if (!credential.identityToken) {
    throw new SocialSignInError("Apple did not return an identity token");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.session) {
    throw new SocialSignInError(
      error?.message ?? "Supabase rejected the token",
    );
  }
  return data.session;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
pnpm test -- social-sign-in
```

Expected: all 7 tests pass.

- [ ] **Step 5: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/apps/mobile/src/features/auth/social-sign-in.ts app/apps/mobile/src/features/auth/social-sign-in.test.ts
git commit -m "feat(auth): add social-sign-in module wrapping Google + Apple SDKs"
```

---

## Task 3: Configure Supabase dashboard (manual)

This is a **manual** task — no code changes, no commit. It must be done before social sign-in or password reset can actually work end-to-end, but it's safe to do at any time after Task 1.

**Where:** Supabase project dashboard (the project pointed to by `SUPABASE_URL` in `.env`).

- [ ] **Step 1: Enable Google provider**

Auth → Providers → Google. Toggle on. Paste `GOOGLE_WEB_CLIENT_ID` into the "Client ID (for OAuth)" field. (No client secret needed for ID-token flow.) Save.

- [ ] **Step 2: Enable Apple provider**

Auth → Providers → Apple. Toggle on. Configure with:

- Services ID: created in Apple Developer console under Identifiers → Services IDs. Bundle ID for the Service ID can be `com.brunomoise.mylanguagecoach.signinwithapple` (or similar, distinct from the app bundle ID).
- Team ID: `428X7TF9S6` (from `memory/reference_apple_developer.md`).
- Key ID + private key: create a new key in Apple Developer console under Keys, enable "Sign in with Apple", download the `.p8`, paste contents.

Save.

- [ ] **Step 3: Enable auto-linking of identities by verified email**

Auth → Settings → scroll to "Manual linking" or "Identity linking". The setting we want is **"Automatically link a new identity to an existing user when the email is verified by both providers"** (exact wording varies by Supabase version). Turn it ON.

If this setting is not visible in the dashboard for your Supabase version, configure it via SQL:

```sql
-- Run in Supabase SQL editor
UPDATE auth.config SET enable_manual_linking = false;
```

(The default is `true` — flipping to `false` enables auto-linking by verified email.)

- [ ] **Step 4: Add reset-password deep-link to redirect URL allowlist**

Auth → URL Configuration → Redirect URLs. Add:

```
mylanguagecoach://reset-password
```

Save.

- [ ] **Step 5: Verify the "Reset Password" email template**

Auth → Email Templates → Reset Password. The default template uses `{{ .ConfirmationURL }}` which will resolve to our deep link. No edit needed unless the team wants custom copy.

- [ ] **Step 6: Smoke test from the dashboard**

In Auth → Users, pick a test account and click "Send password recovery". Confirm the email arrives. (The deep link won't open the app yet because Task 7 hasn't been done — this just confirms email delivery works.)

No commit for this task — it's pure dashboard configuration.

---

## Task 4: Redesign sign-in screen with explicit tabs (no social yet)

Replaces the current `signInWithPassword → signUp` auto-fallback with two distinct modes. No social buttons in this task — those come in Task 5. This task on its own is a meaningful UX improvement.

**Files:**

- Modify: `app/apps/mobile/app/(auth)/sign-in.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `sign-in.tsx`**

Replace the entire contents of `app/apps/mobile/app/(auth)/sign-in.tsx`:

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

type Mode = "signIn" | "signUp";

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 6) return;
    setBusy(true);

    if (mode === "signIn") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setBusy(false);
      if (error) {
        showToast("Email or password is incorrect.");
        return;
      }
      router.replace("/");
      return;
    }

    // Create account
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setBusy(false);
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        showToast("This email already has an account — sign in instead.");
        setMode("signIn");
        return;
      }
      showToast(error.message);
      return;
    }
    if (!data.session) {
      showToast("Check your inbox to confirm your email.");
      return;
    }
    router.replace("/");
  };

  const isDisabled = busy || !email.trim() || password.length < 6;
  const buttonLabel = mode === "signIn" ? "Sign in" : "Create account";

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">My Language Coach</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        {mode === "signIn" ? "Welcome back." : "Create your account."}
      </EditorialText>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setMode("signIn")}
          style={[styles.tab, mode === "signIn" && styles.tabActive]}
        >
          <EditorialText
            kind="bodyMd"
            color={mode === "signIn" ? palette.ink : palette.inkSoft}
          >
            Sign in
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() => setMode("signUp")}
          style={[styles.tab, mode === "signUp" && styles.tabActive]}
        >
          <EditorialText
            kind="bodyMd"
            color={mode === "signUp" ? palette.ink : palette.inkSoft}
          >
            Create account
          </EditorialText>
        </Pressable>
      </View>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          Email
        </EditorialText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[typeTokens.bodyLg, styles.textInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          Password
        </EditorialText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          style={[typeTokens.bodyLg, styles.textInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

      {mode === "signIn" ? (
        <Pressable
          onPress={() => router.push("/(auth)/forgot-password")}
          style={styles.forgotLink}
        >
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Forgot password?
          </EditorialText>
        </Pressable>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {busy ? "Working…" : buttonLabel}
        </EditorialText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.base,
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: palette.glassFaint,
  },
  tabActive: {
    backgroundColor: palette.peach,
  },
  inputCard: {
    marginTop: 0,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
  },
  textInput: {
    color: palette.ink,
    padding: 0,
    minHeight: 24,
  },
  forgotLink: {
    alignSelf: "flex-end",
    paddingVertical: spacing.xs,
  },
  button: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
    ...shadow.cta,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
```

Note: `router.push("/(auth)/forgot-password")` will produce a "missing route" warning until Task 6 — that's expected.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean. (The route warning is runtime-only.)

- [ ] **Step 3: Manual verification**

Launch the dev client:

```bash
pnpm start
```

Then on a test device:

- Sign in with a known good password → land on home.
- Sign in with a wrong password → toast "Email or password is incorrect."
- Toggle to Create account, use an unknown email → either land on home or see "Check your inbox" toast.
- Toggle to Create account, use a known existing email → toast "This email already has an account — sign in instead." and tab flips to Sign in.

- [ ] **Step 4: Commit**

```bash
git add app/apps/mobile/app/(auth)/sign-in.tsx
git commit -m "feat(auth): split sign-in screen into explicit Sign in / Create account tabs"
```

---

## Task 5: Wire Google + Apple buttons into sign-in screen

Adds the social buttons on top of the email/password block, using the module from Task 2.

**Files:**

- Modify: `app/apps/mobile/app/(auth)/sign-in.tsx`
- Create: `app/apps/mobile/src/features/auth/social-button.tsx`

- [ ] **Step 1: Create the SocialButton component**

Create `app/apps/mobile/src/features/auth/social-button.tsx`:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { EditorialText } from "@/src/design";
import {
  palette,
  radius,
  spacing,
  shadow,
} from "@language-coach/design-tokens";

type Props = {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  variant: "google" | "apple";
};

export function SocialButton({
  label,
  onPress,
  busy,
  disabled,
  variant,
}: Props) {
  const isDark = variant === "apple";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[
        styles.button,
        isDark ? styles.buttonDark : styles.buttonLight,
        (busy || disabled) && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator color={isDark ? palette.peach : palette.ink} />
        ) : (
          <EditorialText
            kind="bodyLg"
            color={isDark ? palette.peach : palette.ink}
          >
            {label}
          </EditorialText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
  buttonLight: {
    backgroundColor: palette.peach,
    borderWidth: 1,
    borderColor: palette.glassFaint,
  },
  buttonDark: {
    backgroundColor: palette.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  disabled: { opacity: 0.6 },
});
```

(Icons can be added later if you want a Google/Apple logo — the spec didn't require them; text-only ships fine.)

- [ ] **Step 2: Modify sign-in.tsx to add social buttons + "or" divider**

Edit `app/apps/mobile/app/(auth)/sign-in.tsx`. Add these imports at the top of the file:

```tsx
import { Platform } from "react-native";
import { SocialButton } from "@/src/features/auth/social-button";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
} from "@/src/features/auth/social-sign-in";
```

Update the `useState` block to add per-provider busy state:

```tsx
const [googleBusy, setGoogleBusy] = useState(false);
const [appleBusy, setAppleBusy] = useState(false);
```

Add these two handlers above the existing `submit` function:

```tsx
const onGoogle = async () => {
  setGoogleBusy(true);
  try {
    await signInWithGoogle();
    router.replace("/");
  } catch (err) {
    if (!(err instanceof SocialSignInCancelled)) {
      showToast("Couldn't sign in with Google. Try again.");
    }
  } finally {
    setGoogleBusy(false);
  }
};

const onApple = async () => {
  setAppleBusy(true);
  try {
    await signInWithApple();
    router.replace("/");
  } catch (err) {
    if (!(err instanceof SocialSignInCancelled)) {
      showToast("Couldn't sign in with Apple. Try again.");
    }
  } finally {
    setAppleBusy(false);
  }
};
```

In the JSX, **between the subtitle line and the `tabRow` View**, insert:

```tsx
{Platform.OS === "ios" ? (
  <SocialButton
    label="Continue with Apple"
    onPress={onApple}
    busy={appleBusy}
    disabled={googleBusy || busy}
    variant="apple"
  />
) : null}
<SocialButton
  label="Continue with Google"
  onPress={onGoogle}
  busy={googleBusy}
  disabled={appleBusy || busy}
  variant="google"
/>
<View style={styles.dividerRow}>
  <View style={styles.dividerLine} />
  <EditorialText kind="bodySm" color={palette.inkSoft}>
    or
  </EditorialText>
  <View style={styles.dividerLine} />
</View>
```

Add these style entries to the `StyleSheet.create({...})` block:

```tsx
dividerRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  marginVertical: spacing.sm,
},
dividerLine: {
  flex: 1,
  height: 1,
  backgroundColor: palette.glassFaint,
},
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Manual verification**

(Requires Task 1 dev client rebuild and Task 3 Supabase config.)

```bash
pnpm start
```

On the dev device:

- Tap Continue with Google → native Google chooser appears → pick a test account → land on home (or onboarding if first-time).
- Tap Continue with Google → cancel the chooser → no toast, button returns to idle.
- On iOS: tap Continue with Apple → native sheet → finish → land on home/onboarding.
- On Android: verify the Apple button is hidden.

- [ ] **Step 5: Commit**

```bash
git add app/apps/mobile/app/(auth)/sign-in.tsx app/apps/mobile/src/features/auth/social-button.tsx
git commit -m "feat(auth): add Google + Apple sign-in buttons on sign-in screen"
```

---

## Task 6: Forgot-password screen

Adds the destination for the "Forgot password?" link from Task 4.

**Files:**

- Create: `app/apps/mobile/app/(auth)/forgot-password.tsx`

- [ ] **Step 1: Create the screen**

Create `app/apps/mobile/app/(auth)/forgot-password.tsx`:

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!/.+@.+\..+/.test(trimmedEmail)) {
      showToast("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: "mylanguagecoach://reset-password",
    });
    setBusy(false);
    // Always show success regardless of whether the email exists — prevents enumeration.
    setSent(true);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <EditorialText kind="displayLg">Check your inbox.</EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          If that email is registered, we&apos;ve sent a reset link. It expires
          in about an hour.
        </EditorialText>
        <Pressable
          onPress={() => router.replace("/(auth)/sign-in")}
          style={styles.button}
        >
          <EditorialText kind="bodyLg" color={palette.peach}>
            Back to sign in
          </EditorialText>
        </Pressable>
      </View>
    );
  }

  const isDisabled = busy || !email.trim();

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">Forgot password?</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        Enter the email you signed up with. We&apos;ll send a link to set a new
        password.
      </EditorialText>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          Email
        </EditorialText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[typeTokens.bodyLg, styles.textInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

      <Pressable
        onPress={submit}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {busy ? "Sending…" : "Send reset link"}
        </EditorialText>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.secondary}>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          Cancel
        </EditorialText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.base,
    justifyContent: "center",
  },
  inputCard: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  textInput: { color: palette.ink, padding: 0, minHeight: 24 },
  button: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
    ...shadow.cta,
  },
  buttonDisabled: { opacity: 0.6 },
  secondary: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean. The "missing route" warning from Task 4 should disappear.

- [ ] **Step 3: Manual verification**

```bash
pnpm start
```

- From sign-in (Sign in tab), tap "Forgot password?" → forgot-password screen.
- Enter a valid email → "Check your inbox" view appears.
- Check the inbox for the registered test account — reset email should arrive.
- (Tapping the email link won't yet work — that's Task 7.)

- [ ] **Step 4: Commit**

```bash
git add app/apps/mobile/app/(auth)/forgot-password.tsx
git commit -m "feat(auth): add forgot password screen"
```

---

## Task 7: Reset-password screen + deep link handling

Receives the reset-password deep link, establishes a session from the link's tokens (mirroring the verify.tsx pattern), and lets the user set a new password.

**Files:**

- Create: `app/apps/mobile/app/(auth)/reset-password.tsx`

- [ ] **Step 1: Create the screen**

Create `app/apps/mobile/app/(auth)/reset-password.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

type Phase = "verifying" | "ready" | "expired" | "saving";

export default function ResetPasswordScreen() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const consume = async (url: string) => {
      // PKCE first
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error && data.session) {
          setPhase("ready");
          return;
        }
      } catch {
        // fall through
      }
      // Fragment / query tokens
      const fragmentIndex = url.indexOf("#");
      const queryIndex = url.indexOf("?");
      const tokenSource =
        fragmentIndex >= 0
          ? url.slice(fragmentIndex + 1)
          : queryIndex >= 0
            ? url.slice(queryIndex + 1)
            : "";
      const params = new URLSearchParams(tokenSource);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!error) {
          setPhase("ready");
          return;
        }
      }
      setPhase("expired");
    };

    Linking.getInitialURL().then((url) => {
      if (url) void consume(url);
      else setPhase("expired");
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      void consume(url);
    });
    return () => sub.remove();
  }, []);

  const onSave = async () => {
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords don't match.");
      return;
    }
    setPhase("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showToast(error.message);
      setPhase("ready");
      return;
    }
    showToast("Password updated.");
    router.replace("/");
  };

  if (phase === "verifying") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={{ marginTop: spacing.md }}
        >
          Verifying reset link…
        </EditorialText>
      </View>
    );
  }

  if (phase === "expired") {
    return (
      <View style={styles.container}>
        <EditorialText kind="displayLg">Link expired.</EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          Reset links expire after about an hour. Request a new one.
        </EditorialText>
        <Pressable
          onPress={() => router.replace("/(auth)/forgot-password")}
          style={styles.button}
        >
          <EditorialText kind="bodyLg" color={palette.peach}>
            Request new link
          </EditorialText>
        </Pressable>
      </View>
    );
  }

  const isDisabled =
    phase === "saving" || password.length < 6 || password !== confirm;

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">Set a new password.</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        Pick something you&apos;ll remember.
      </EditorialText>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          New password
        </EditorialText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          style={[typeTokens.bodyLg, styles.textInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          Confirm
        </EditorialText>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Type it again"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          style={[typeTokens.bodyLg, styles.textInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

      <Pressable
        onPress={onSave}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {phase === "saving" ? "Saving…" : "Save password"}
        </EditorialText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.base,
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  inputCard: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  textInput: { color: palette.ink, padding: 0, minHeight: 24 },
  button: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
    ...shadow.cta,
  },
  buttonDisabled: { opacity: 0.6 },
});
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Manual end-to-end verification**

(Requires Task 3 — `mylanguagecoach://reset-password` in Supabase redirect allowlist.)

```bash
pnpm start
```

On the dev device:

- Sign out if signed in.
- From sign-in → Forgot password → enter the email of a known account → "Check your inbox."
- Open the email. Tap the link. The app should open to the reset-password screen with the "Set a new password" form.
- Enter a new password twice → tap Save → "Password updated" toast → land on home.
- Sign out. Sign in with the new password → success.

If the link opens but shows "Link expired" immediately, check Supabase dashboard: the redirect URL allowlist must contain `mylanguagecoach://reset-password` exactly (no trailing slash).

- [ ] **Step 4: Commit**

```bash
git add app/apps/mobile/app/(auth)/reset-password.tsx
git commit -m "feat(auth): add reset-password screen with deep link handling"
```

---

## Task 8: `use-identities` hook with tests

Exposes the user's linked identities and link/unlink mutations to Profile-side UI. Pure logic — unit-testable.

**Files:**

- Create: `app/apps/mobile/src/features/auth/use-identities.ts`
- Create: `app/apps/mobile/src/features/auth/use-identities.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/apps/mobile/src/features/auth/use-identities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { identitiesFromSession, canUnlink } from "./use-identities";

describe("identitiesFromSession", () => {
  it("returns an empty list when session is null", () => {
    expect(identitiesFromSession(null)).toEqual([]);
  });

  it("normalizes Supabase identities array to {id, provider} entries", () => {
    const session = {
      user: {
        identities: [
          { id: "id-1", identity_id: "i1", provider: "email" },
          { id: "id-2", identity_id: "i2", provider: "google" },
        ],
      },
    } as never;
    expect(identitiesFromSession(session)).toEqual([
      { id: "id-1", identityId: "i1", provider: "email" },
      { id: "id-2", identityId: "i2", provider: "google" },
    ]);
  });
});

describe("canUnlink", () => {
  it("returns false when there is only one identity", () => {
    const identities = [
      { id: "id-1", identityId: "i1", provider: "email" as const },
    ];
    expect(canUnlink(identities, identities[0]!)).toBe(false);
  });

  it("returns true when there are multiple identities", () => {
    const identities = [
      { id: "id-1", identityId: "i1", provider: "email" as const },
      { id: "id-2", identityId: "i2", provider: "google" as const },
    ];
    expect(canUnlink(identities, identities[0]!)).toBe(true);
    expect(canUnlink(identities, identities[1]!)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- use-identities
```

Expected: fails with "cannot resolve module".

- [ ] **Step 3: Implement the hook**

Create `app/apps/mobile/src/features/auth/use-identities.ts`:

```ts
import type { Session } from "@supabase/supabase-js";
import { useAuthStore } from "./auth-store";

export type IdentityProvider = "email" | "google" | "apple";

export type Identity = {
  id: string;
  identityId: string;
  provider: IdentityProvider;
};

export function identitiesFromSession(session: Session | null): Identity[] {
  const raw = session?.user?.identities ?? [];
  return raw
    .map((i) => {
      const provider = i.provider as string;
      if (
        provider !== "email" &&
        provider !== "google" &&
        provider !== "apple"
      ) {
        return null;
      }
      return {
        id: i.id,
        identityId: (i as { identity_id?: string }).identity_id ?? i.id,
        provider: provider as IdentityProvider,
      };
    })
    .filter((x): x is Identity => x !== null);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canUnlink(all: Identity[], _target: Identity): boolean {
  return all.length > 1;
}

export function useIdentities(): Identity[] {
  const session = useAuthStore((s) => s.session);
  return identitiesFromSession(session);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test -- use-identities
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/apps/mobile/src/features/auth/use-identities.ts app/apps/mobile/src/features/auth/use-identities.test.ts
git commit -m "feat(auth): add use-identities hook for listing linked auth providers"
```

---

## Task 9: Sign-in methods sheet on Profile

Lets a logged-in user see, link, and unlink their auth providers from the Profile screen.

**Files:**

- Create: `app/apps/mobile/src/features/profile/sign-in-methods-sheet.tsx`
- Modify: `app/apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create the sheet**

Create `app/apps/mobile/src/features/profile/sign-in-methods-sheet.tsx`:

```tsx
import { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
} from "@/src/features/auth/social-sign-in";
import {
  canUnlink,
  useIdentities,
  type Identity,
  type IdentityProvider,
} from "@/src/features/auth/use-identities";

const PROVIDER_LABEL: Record<IdentityProvider, string> = {
  email: "Email & password",
  google: "Google",
  apple: "Apple",
};

export const SignInMethodsSheet = forwardRef<BottomSheetModal>(
  function SignInMethodsSheet(_, ref) {
    const identities = useIdentities();
    const [busy, setBusy] = useState<IdentityProvider | null>(null);

    const linked = new Set(identities.map((i) => i.provider));
    const canLinkGoogle = !linked.has("google");
    const canLinkApple = Platform.OS === "ios" && !linked.has("apple");

    const onLink = async (provider: "google" | "apple") => {
      setBusy(provider);
      try {
        // Calling signInWith* while authenticated, with Supabase's auto-link
        // setting on, attaches the new identity to the current user.
        if (provider === "google") await signInWithGoogle();
        else await signInWithApple();
        showToast(`${PROVIDER_LABEL[provider]} linked.`);
      } catch (err) {
        if (!(err instanceof SocialSignInCancelled)) {
          showToast(`Couldn't link ${PROVIDER_LABEL[provider]}.`);
        }
      } finally {
        setBusy(null);
      }
    };

    const onUnlink = async (identity: Identity) => {
      if (!canUnlink(identities, identity)) return;
      setBusy(identity.provider);
      const { error } = await supabase.auth.unlinkIdentity({
        identity_id: identity.identityId,
        id: identity.id,
        provider: identity.provider,
      } as never);
      setBusy(null);
      if (error) {
        showToast(error.message);
        return;
      }
      showToast(`${PROVIDER_LABEL[identity.provider]} unlinked.`);
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["55%"]}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <EditorialText kind="displayMd" style={styles.title}>
            Sign-in methods
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg">
            {identities.map((identity, idx) => {
              const unlinkable = canUnlink(identities, identity);
              return (
                <View
                  key={identity.id}
                  style={[
                    styles.row,
                    idx < identities.length - 1 && styles.rowDivider,
                  ]}
                >
                  <EditorialText kind="bodyLg" color={palette.ink}>
                    {PROVIDER_LABEL[identity.provider]}
                  </EditorialText>
                  <Pressable
                    onPress={() => onUnlink(identity)}
                    disabled={!unlinkable || busy !== null}
                    style={styles.action}
                  >
                    <EditorialText
                      kind="bodyMd"
                      color={unlinkable ? palette.danger : palette.inkSoft}
                    >
                      {busy === identity.provider ? "…" : "Unlink"}
                    </EditorialText>
                  </Pressable>
                </View>
              );
            })}
          </GlassCard>

          {!unlinkableHelperHidden(identities) ? (
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.helper}
            >
              You need at least one way to sign in.
            </EditorialText>
          ) : null}

          {canLinkGoogle ? (
            <Pressable
              onPress={() => onLink("google")}
              disabled={busy !== null}
              style={styles.linkButton}
            >
              <EditorialText kind="bodyLg" color={palette.ink}>
                {busy === "google" ? "Linking…" : "Link Google"}
              </EditorialText>
            </Pressable>
          ) : null}
          {canLinkApple ? (
            <Pressable
              onPress={() => onLink("apple")}
              disabled={busy !== null}
              style={styles.linkButton}
            >
              <EditorialText kind="bodyLg" color={palette.ink}>
                {busy === "apple" ? "Linking…" : "Link Apple"}
              </EditorialText>
            </Pressable>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

function unlinkableHelperHidden(identities: Identity[]) {
  return identities.length !== 1;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.peach,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: palette.glassFaint },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: { marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.glassFaint,
  },
  action: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  helper: { marginTop: -spacing.xs, marginLeft: spacing.sm },
  linkButton: {
    backgroundColor: palette.glassFaint,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: "center",
  },
});
```

Note on the in-app linking mechanism: when the user is already signed in and we call `signInWithGoogle()` / `signInWithApple()`, Supabase — with the auto-link-by-email setting on from Task 3 — will attach the new identity to the current user if the email matches. If the email does NOT match, it'll switch the session to a different user. This is a known edge case; the spec defers handling to a future iteration. For now, the assumption matches Bruno's mental model: "I'm linking my Google to my account, and it has the same email."

- [ ] **Step 2: Add the row to Profile screen**

Edit `app/apps/mobile/app/(tabs)/profile.tsx`. Add imports near the top:

```tsx
import { SignInMethodsSheet } from "@/src/features/profile/sign-in-methods-sheet";
```

In `ProfileScreen`, add a ref alongside the others:

```tsx
const signInMethodsRef = useRef<BottomSheetModal>(null);
```

In the Account section's `GlassCard`, add a new `ProfileRow` just before the last (`Daily goal`) row — change `Daily goal`'s `isLast` to remain `isLast`, and insert before it:

```tsx
<ProfileRow
  label="Sign-in methods"
  value="Manage"
  onPress={() => signInMethodsRef.current?.present()}
/>
```

At the bottom of the JSX (alongside the other sheets), add:

```tsx
<SignInMethodsSheet ref={signInMethodsRef} />
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Manual verification**

```bash
pnpm start
```

On a dev device, with a signed-in account:

- Profile → Sign-in methods → sheet opens showing current identities.
- If the account only has Email — Unlink should be disabled with the helper text shown.
- Tap "Link Google" → native chooser → pick the _same email_ → toast "Google linked." → reopen the sheet, Google now listed.
- Unlink Google → toast "Google unlinked." → Google disappears.

- [ ] **Step 5: Commit**

```bash
git add app/apps/mobile/src/features/profile/sign-in-methods-sheet.tsx app/apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat(profile): add sign-in methods sheet for linking/unlinking auth providers"
```

---

## Task 10: Change-password sheet on Profile

Lets a logged-in user who has an email/password identity change their password.

**Files:**

- Create: `app/apps/mobile/src/features/profile/change-password-sheet.tsx`
- Modify: `app/apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create the sheet**

Create `app/apps/mobile/src/features/profile/change-password-sheet.tsx`:

```tsx
import { forwardRef, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard, TAB_BAR_RESERVE } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

type Props = {
  email: string;
};

export const ChangePasswordSheet = forwardRef<BottomSheetModal, Props>(
  function ChangePasswordSheet({ email }, ref) {
    const insets = useSafeAreaInsets();
    const footerInset = insets.bottom + TAB_BAR_RESERVE;
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [saving, setSaving] = useState(false);

    const valid = current.length >= 1 && next.length >= 6;

    const handleSave = async () => {
      if (!valid) return;
      setSaving(true);
      // Verify current password first via silent sign-in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInErr) {
        setSaving(false);
        showToast("Current password is incorrect.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({
        password: next,
      });
      setSaving(false);
      if (updateErr) {
        showToast(updateErr.message);
        return;
      }
      showToast("Password updated.");
      setCurrent("");
      setNext("");
      (ref as { current: BottomSheetModal | null }).current?.dismiss();
    };

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={footerInset}>
          <Pressable
            onPress={handleSave}
            disabled={!valid || saving}
            style={[styles.saveButton, (!valid || saving) && styles.disabled]}
          >
            <EditorialText
              kind="bodyLg"
              color={palette.peach}
              style={{ fontWeight: "600" }}
            >
              {saving ? "Saving…" : "Update password"}
            </EditorialText>
          </Pressable>
        </BottomSheetFooter>
      ),
      [saving, valid, current, next, footerInset],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["65%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.titleRow}>
            <EditorialText kind="displayMd">Change password</EditorialText>
          </View>
          <GlassCard padding="md" style={styles.field}>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.fieldLabel}
            >
              Current password
            </EditorialText>
            <BottomSheetTextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              placeholder="••••••"
              autoCapitalize="none"
              style={[typeTokens.bodyLg, styles.input]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
          <GlassCard padding="md" style={styles.field}>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.fieldLabel}
            >
              New password
            </EditorialText>
            <BottomSheetTextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              placeholder="At least 6 characters"
              autoCapitalize="none"
              style={[typeTokens.bodyLg, styles.input]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.peach,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: palette.glassFaint },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.base },
  titleRow: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  field: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  input: { color: palette.ink, padding: 0, minHeight: 28 },
  saveButton: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Conditionally add the row to Profile screen**

Edit `app/apps/mobile/app/(tabs)/profile.tsx`. Add imports:

```tsx
import { ChangePasswordSheet } from "@/src/features/profile/change-password-sheet";
import { useIdentities } from "@/src/features/auth/use-identities";
```

In `ProfileScreen`, add:

```tsx
const changePasswordRef = useRef<BottomSheetModal>(null);
const identities = useIdentities();
const hasEmailIdentity = identities.some((i) => i.provider === "email");
const email = (profile as { email?: string }).email ?? "";
```

In the Account section's `GlassCard`, just below the existing `Email` row, add (only when applicable):

```tsx
{
  hasEmailIdentity ? (
    <ProfileRow
      label="Change password"
      value="•••••••"
      onPress={() => changePasswordRef.current?.present()}
    />
  ) : null;
}
```

At the bottom of the JSX with other sheets, add (only when applicable so we don't mount a sheet without an email):

```tsx
{
  hasEmailIdentity ? (
    <ChangePasswordSheet ref={changePasswordRef} email={email} />
  ) : null;
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Manual verification**

```bash
pnpm start
```

On a dev device:

- Profile (signed in with email/password) → "Change password" row visible.
- Tap → sheet opens.
- Wrong current password → toast "Current password is incorrect."
- Correct current + new (≥6 chars) → toast "Password updated." → sheet dismisses.
- Sign out, sign in with the new password → success.
- On a Google-only account: "Change password" row hidden.

- [ ] **Step 5: Commit**

```bash
git add app/apps/mobile/src/features/profile/change-password-sheet.tsx app/apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat(profile): add change-password sheet for email-identity users"
```

---

## Self-review notes

**Spec coverage check:**

- Spec §1 Sign-in screen redesign → Tasks 4 + 5.
- Spec §2 Social auth → Tasks 1 (deps/config) + 2 (module) + 5 (UI).
- Spec §3 Password reset → Tasks 6 (forgot) + 7 (reset).
- Spec §4 Account linking → Task 3 (dashboard config).
- Spec §5 Profile additions → Tasks 8 (hook) + 9 (sign-in methods) + 10 (change password).
- Spec §6 Existing users / no migration → covered implicitly (Task 4 preserves "confirm email" branch).

**Open implementation question called out in the spec:** the in-app "Link Google/Apple" flow on Profile uses `signInWithIdToken` while already authenticated and relies on Supabase's auto-link setting from Task 3. If runtime testing reveals this doesn't behave as expected (e.g., it creates a new session for a new user instead of attaching), the fallback is to use Supabase's `linkIdentity` API which initiates an OAuth web flow — implement that variant in Task 9 if the simple path fails.

**Manual config sequencing:** Task 3 (Supabase dashboard) and the Bruno hand-off in Task 1 (env vars + EAS rebuild + Apple/Google console setup) are blocking for Tasks 5, 7, 9. The implementation can run through Tasks 2, 4, 6, 8 without those being done, but end-to-end verification of 5, 7, 9 needs them.
