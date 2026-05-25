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
