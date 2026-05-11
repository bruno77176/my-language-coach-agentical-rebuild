import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { GlassCard, EditorialText } from "@/src/design";
import {
  palette,
  spacing,
  radius,
  shadow,
  type,
} from "@language-coach/design-tokens";

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View
      style={{ flexDirection: "row", gap: spacing.xs, paddingTop: spacing.sm }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === step ? palette.accent : palette.glassFaint,
          }}
        />
      ))}
    </View>
  );
}

export default function NameStep() {
  const initial = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const [value, setValue] = useState(initial);

  const onNext = () => {
    if (!value.trim()) return;
    setDisplayName(value.trim());
    router.push("/(onboarding)/native-lang");
  };

  const isDisabled = !value.trim();

  return (
    <View style={styles.container}>
      <ProgressDots step={0} total={4} />

      <EditorialText kind="displayLg">What&apos;s your name?</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        Your coach will use this to greet you.
      </EditorialText>

      <GlassCard padding="md">
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Your first name"
          autoCapitalize="words"
          placeholderTextColor={palette.inkSoft}
          style={[type.bodyLg, styles.input]}
        />
      </GlassCard>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onNext}
        disabled={isDisabled}
        style={[styles.cta, isDisabled && styles.ctaDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          Continue
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
  },
  input: {
    color: palette.ink,
    padding: 0,
    minHeight: 28,
  },
  cta: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.cta,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
});
