import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
      <View style={styles.body}>
        <EditorialText kind="displayLg">Check your inbox.</EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.copy}
        >
          We sent a confirmation link to both your old and new email addresses.
          Click both to complete the change.
        </EditorialText>
        <Pressable style={styles.cta} onPress={() => router.back()}>
          <EditorialText kind="bodyLg" color={palette.peach}>
            Done
          </EditorialText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: spacing.xl, gap: spacing.base, flexGrow: 1 },
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
