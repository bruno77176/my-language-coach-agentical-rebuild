import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 6) return;
    setBusy(true);

    // Try sign in first; if user doesn't exist, fall through to sign up.
    const signInResult = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (!signInResult.error) {
      // eslint-disable-next-line no-console
      console.log("[SIGN-IN] signInWithPassword OK");
      setBusy(false);
      router.replace("/");
      return;
    }
    // eslint-disable-next-line no-console
    console.log(
      "[SIGN-IN] signInWithPassword failed:",
      signInResult.error.message,
    );

    // "Invalid login credentials" can mean wrong password OR no such user.
    // Try sign up; if THAT errors with "already registered", the password
    // was wrong on the first call.
    const signUpResult = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setBusy(false);

    if (signUpResult.error) {
      const msg = signUpResult.error.message;
      // eslint-disable-next-line no-console
      console.log("[SIGN-IN] signUp failed:", msg);
      if (/already|registered|exists/i.test(msg)) {
        Alert.alert(
          "Wrong password",
          "This email is registered but the password didn't match.",
        );
      } else {
        Alert.alert("Sign-in failed", msg);
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      "[SIGN-IN] signUp OK — has session:",
      !!signUpResult.data.session,
    );

    // Sign-up succeeded. Some Supabase configs auto-confirm + return a session
    // immediately; if the session is null, the user needs to confirm email.
    if (!signUpResult.data.session) {
      Alert.alert(
        "Email confirmation required",
        "Account created but Supabase needs you to confirm the email first. Either check your inbox for a confirmation link, or in Supabase dashboard → Authentication → Providers → Email, turn off 'Confirm email'.",
      );
      return;
    }
    // Successful new account with session → navigate.
    router.replace("/");
  };

  const isDisabled = busy || !email.trim() || password.length < 6;

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">My Language Coach</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        Sign in or create your account.
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

      <Pressable
        onPress={submit}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {busy ? "Signing in…" : "Sign in / Sign up"}
        </EditorialText>
      </Pressable>

      <EditorialText kind="bodySm" color={palette.inkSoft} align="center">
        First time? Pick any password you&apos;ll remember; we&apos;ll create
        your account.
      </EditorialText>
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
