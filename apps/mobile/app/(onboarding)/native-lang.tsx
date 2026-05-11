import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { GlassCard, EditorialText } from "@/src/design";
import {
  palette,
  spacing,
  radius,
  shadow,
  touch,
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

export default function NativeLangStep() {
  const selected = useOnboardingStore((s) => s.nativeLang);
  const setNativeLang = useOnboardingStore((s) => s.setNativeLang);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ProgressDots step={1} total={4} />

        <EditorialText kind="displayLg">Your native language?</EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          Used for translations.
        </EditorialText>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              onPress={() => setNativeLang(lang.code)}
              style={styles.rowPressable}
            >
              <GlassCard
                padding="md"
                radiusToken="md"
                style={isSelected ? styles.rowSelected : undefined}
              >
                <View style={styles.rowInner}>
                  <EditorialText kind="bodyLg" style={styles.flag}>
                    {lang.flag}
                  </EditorialText>
                  <View style={styles.rowText}>
                    <EditorialText kind="bodyMd" color={palette.ink}>
                      {lang.englishName}
                    </EditorialText>
                    <EditorialText kind="bodySm" color={palette.inkSoft}>
                      {lang.nativeName}
                    </EditorialText>
                  </View>
                  {isSelected && (
                    <EditorialText kind="bodyMd" color={palette.accent}>
                      ✓
                    </EditorialText>
                  )}
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/(onboarding)/target-lang")}
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
  rowPressable: {
    minHeight: touch.min,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touch.min - spacing.base * 2,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  flag: {
    fontSize: 24,
  },
  rowText: {
    flex: 1,
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
