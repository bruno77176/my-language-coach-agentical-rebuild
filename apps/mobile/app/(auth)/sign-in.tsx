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
        // Intentionally don't reset email/password — they're prefilled for the sign-in retry.
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
          disabled={busy}
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
          disabled={busy}
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
