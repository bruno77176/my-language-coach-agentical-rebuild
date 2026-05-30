import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { EditorialText } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useUpdateMemoryConsent } from "@/src/features/coach-memory/use-update-memory-consent";

export default function MemoryConsentScreen() {
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const [busy, setBusy] = useState(false);
  const updateConsent = useUpdateMemoryConsent();

  const onAccept = async () => {
    setBusy(true);
    try {
      await updateConsent.mutateAsync({
        languageCode: targetLang,
        optedOut: false,
      });
      router.replace("/(tabs)/home");
    } catch (e) {
      Alert.alert("Couldn't save your choice", String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSkip = async () => {
    setBusy(true);
    try {
      await updateConsent.mutateAsync({
        languageCode: targetLang,
        optedOut: true,
      });
      router.replace("/(tabs)/home");
    } catch (e) {
      Alert.alert("Couldn't save your choice", String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <EditorialText kind="displayMd" italic style={styles.title}>
        Your coach remembers you
      </EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft} style={styles.body}>
        To make conversations feel like real coaching, we save a short profile
        of what you&apos;ve talked about, your level, and topics you&apos;d like
        to practice.
      </EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft} style={styles.body}>
        You can view, edit, or delete this memory anytime under Profile →
        Coach&apos;s Memory.
      </EditorialText>
      <Pressable
        onPress={onAccept}
        style={[styles.cta, busy && styles.disabled]}
        disabled={busy}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          Continue
        </EditorialText>
      </Pressable>
      <Pressable
        onPress={onSkip}
        style={[styles.skip, busy && styles.disabled]}
        disabled={busy}
      >
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          Skip — I don&apos;t want my coach to remember me
        </EditorialText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: { marginBottom: spacing.lg, color: palette.ink },
  body: { marginBottom: spacing.base },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    paddingVertical: spacing.base + 2,
    alignItems: "center",
    ...shadow.cta,
  },
  skip: {
    marginTop: spacing.md,
    padding: spacing.md,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
});
