import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email ?? "").trim().toLowerCase();
  const status = useAuthStore((s) => s.status);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  // If a session arrives mid-screen (e.g. the user opened the magic link in a
  // browser and the deep-link redirect set the session via onAuthStateChange),
  // bail to the app gate — it'll route to onboarding or home.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status]);

  const onSubmit = async () => {
    if (!email) {
      showToast("Missing email. Start over.");
      router.replace("/(auth)/sign-in");
      return;
    }
    if (code.length < 4) {
      showToast("Enter the code from your email.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setBusy(false);
    if (error) {
      // eslint-disable-next-line no-console
      console.log("[VERIFY-EMAIL] verifyOtp error:", error.message);
      if (/expired|invalid|incorrect|token/i.test(error.message)) {
        showToast("Invalid or expired code. Tap Resend for a new one.");
      } else {
        showToast(error.message);
      }
      return;
    }
    showToast("Email confirmed.");
    router.replace("/");
  };

  const onResend = async () => {
    if (!email) {
      showToast("Missing email.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      if (/rate|too many|try again/i.test(error.message)) {
        showToast("Too many requests. Wait a minute before trying again.");
      } else {
        showToast(error.message);
      }
      return;
    }
    showToast("Code sent. Check your inbox.");
  };

  const isDisabled = busy || code.length < 4;

  return (
    <View style={styles.container}>
      <EditorialText kind="displayLg">Confirm your email.</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        {email
          ? `We sent a code to ${email}. Enter it below to finish creating your account.`
          : "Check your inbox for the confirmation code."}
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

      <Pressable
        onPress={onSubmit}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {busy ? "Confirming…" : "Confirm email"}
        </EditorialText>
      </Pressable>

      <Pressable
        onPress={onResend}
        disabled={resending || busy}
        style={styles.secondary}
      >
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {resending ? "Sending…" : "Resend code"}
        </EditorialText>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(auth)/sign-in")}
        style={styles.secondary}
      >
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          Use a different email
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
