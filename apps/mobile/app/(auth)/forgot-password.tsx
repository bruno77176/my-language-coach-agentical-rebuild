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
