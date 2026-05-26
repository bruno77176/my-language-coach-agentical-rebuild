import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email ?? "").trim().toLowerCase();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email) {
      showToast("Missing email. Restart the password reset.");
      router.replace("/(auth)/forgot-password");
      return;
    }
    if (code.length < 4) {
      showToast("Enter the code from your email.");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });
    if (verifyErr) {
      setBusy(false);
      // eslint-disable-next-line no-console
      console.log("[RESET] verifyOtp error:", verifyErr.message);
      if (/expired|invalid|incorrect|token/i.test(verifyErr.message)) {
        showToast("Invalid or expired code. Request a new one.");
      } else {
        showToast(verifyErr.message);
      }
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateErr) {
      // eslint-disable-next-line no-console
      console.log("[RESET] updateUser error:", updateErr.message);
      showToast(updateErr.message);
      return;
    }
    showToast("Password updated.");
    router.replace("/");
  };

  const isDisabled =
    busy || code.length < 4 || password.length < 6 || password !== confirm;

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">Enter the code.</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        {email
          ? `We sent a code to ${email}. Check your inbox.`
          : "Check your inbox for the reset code."}
      </EditorialText>

      <GlassCard padding="md" style={styles.inputCard}>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fieldLabel}
        >
          Verification code
        </EditorialText>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 10))}
          placeholder="Code from email"
          keyboardType="number-pad"
          maxLength={10}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          style={[typeTokens.bodyLg, styles.codeInput]}
          placeholderTextColor={palette.inkSoft}
        />
      </GlassCard>

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
        onPress={onSubmit}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {busy ? "Saving…" : "Save password"}
        </EditorialText>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(auth)/forgot-password")}
        style={styles.secondary}
      >
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          Didn&apos;t get a code? Request a new one.
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
  codeInput: {
    color: palette.ink,
    padding: 0,
    minHeight: 24,
    letterSpacing: 6,
    fontSize: 20,
  },
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
