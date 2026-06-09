import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { SocialButton } from "@/src/features/auth/social-button";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
} from "@/src/features/auth/social-sign-in";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import { PasswordInput } from "@/src/design/PasswordInput";
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const emailYRef = useRef(0);
  const passwordYRef = useRef(0);

  // Bring the focused field into view above the keyboard. We scroll to the
  // field's own measured Y (captured via onLayout on its wrapper) rather than
  // scrolling to the end of the form — scrollToEnd pushed the top field (email)
  // off-screen on a second focus, and on Android the keyboard can cover ~40% of
  // the screen with edge-to-edge disabling the OS auto-resize. Deferred a frame
  // so the keyboard inset/reflow is applied before we scroll.
  const scrollFieldIntoView = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - spacing.xl),
        animated: true,
      });
    });
  };

  const onGoogle = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      if (err instanceof SocialSignInCancelled) return;
      const msg = err instanceof Error ? err.message : "";
      if (
        /unconfirmed|not confirmed|email not verified|verify your email/i.test(
          msg,
        )
      ) {
        showToast(
          "This email has an unconfirmed account. Check your inbox or use Forgot password.",
        );
      } else {
        showToast("Couldn't sign in with Google. Try again.");
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const onApple = async () => {
    setAppleBusy(true);
    try {
      const { fullName } = await signInWithApple();
      // Seed onboarding with the name Apple already gave us so the name step
      // auto-skips — Apple forbids re-asking for it (Guideline 4).
      if (fullName) useOnboardingStore.getState().setDisplayName(fullName);
      router.replace("/");
    } catch (err) {
      if (err instanceof SocialSignInCancelled) return;
      const msg = err instanceof Error ? err.message : "";
      if (
        /unconfirmed|not confirmed|email not verified|verify your email/i.test(
          msg,
        )
      ) {
        showToast(
          "This email has an unconfirmed account. Check your inbox or use Forgot password.",
        );
      } else {
        showToast("Couldn't sign in with Apple. Try again.");
      }
    } finally {
      setAppleBusy(false);
    }
  };

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
        // Intentionally don't reset email/password — they're prefilled for the sign-in retry.
        setMode("signIn");
        return;
      }
      showToast(error.message);
      return;
    }
    if (!data.session) {
      // Signup succeeded but email confirmation is pending. Route to the
      // code-entry screen instead of leaving the user stranded with a toast
      // and no clear next step.
      router.push({
        pathname: "/(auth)/verify",
        params: { email: trimmedEmail },
      });
      return;
    }
    router.replace("/");
  };

  const isDisabled =
    busy || googleBusy || appleBusy || !email.trim() || password.length < 6;
  const buttonLabel = mode === "signIn" ? "Sign in" : "Create account";

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <EditorialText kind="displayLg">My Language Coach</EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          {mode === "signIn" ? "Welcome back." : "Create your account."}
        </EditorialText>

        {Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.lg}
            style={styles.appleButton}
            onPress={onApple}
          />
        ) : null}
        <SocialButton
          label="Continue with Google"
          onPress={onGoogle}
          busy={googleBusy}
          disabled={appleBusy || busy}
        />
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            or
          </EditorialText>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setMode("signIn")}
            disabled={busy || googleBusy || appleBusy}
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
            disabled={busy || googleBusy || appleBusy}
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

        <View
          onLayout={(e) => {
            emailYRef.current = e.nativeEvent.layout.y;
          }}
        >
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
              onFocus={() => scrollFieldIntoView(emailYRef.current)}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={[typeTokens.bodyLg, styles.textInput]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
        </View>

        <View
          onLayout={(e) => {
            passwordYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <GlassCard padding="md" style={styles.inputCard}>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.fieldLabel}
            >
              Password
            </EditorialText>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => scrollFieldIntoView(passwordYRef.current)}
              placeholder="At least 6 characters"
              autoCapitalize="none"
              autoComplete="password"
              style={[typeTokens.bodyLg, styles.textInput]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
        </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
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
  appleButton: {
    height: 48,
    width: "100%",
  },
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
});
