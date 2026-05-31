import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { LanguageRow } from "@/src/features/onboarding/language-row";
import { EditorialText } from "@/src/design";
import {
  palette,
  spacing,
  radius,
  shadow,
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

export default function TargetLangStep() {
  const selected = useOnboardingStore((s) => s.targetLang);
  const setTargetLang = useOnboardingStore((s) => s.setTargetLang);

  const onPickLang = useCallback(
    (code: string) => setTargetLang(code),
    [setTargetLang],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ProgressDots step={2} total={4} />

        <EditorialText kind="displayLg">
          What language do you want to learn?
        </EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          You can change this later.
        </EditorialText>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
      >
        {LANGUAGES.map((lang) => (
          <LanguageRow
            key={lang.code}
            code={lang.code}
            englishName={lang.englishName}
            nativeName={lang.nativeName}
            flag={lang.flag}
            isSelected={selected === lang.code}
            onPress={onPickLang}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/(onboarding)/daily-goal")}
          disabled={!selected}
          style={[styles.cta, !selected && styles.ctaDisabled]}
        >
          <EditorialText kind="bodyLg" color={palette.peach}>
            Continue
          </EditorialText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.base,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing.base,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
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
