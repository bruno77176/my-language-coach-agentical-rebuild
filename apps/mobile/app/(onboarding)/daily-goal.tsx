import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useCompleteOnboarding } from "@/src/features/onboarding/use-complete-onboarding";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { GlassCard, EditorialText } from "@/src/design";
import {
  palette,
  spacing,
  radius,
  shadow,
} from "@language-coach/design-tokens";

const GOAL_OPTIONS = [3, 5, 10, 15, 20];

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

export default function DailyGoalStep() {
  const initial = useOnboardingStore((s) => s.dailyGoalMinutes);
  const setDailyGoalMinutes = useOnboardingStore((s) => s.setDailyGoalMinutes);
  const [selected, setSelected] = useState(initial);
  const mutation = useCompleteOnboarding();

  const onFinish = async () => {
    setDailyGoalMinutes(selected);
    try {
      await mutation.mutateAsync();
      // Navigate directly to /(tabs)/home — the mutation's onSuccess awaited
      // the profile refetch, so going through the index gate would also work,
      // but going direct skips an extra render cycle.
      router.replace("/(tabs)/home");
    } catch (err) {
      Alert.alert("Couldn't complete onboarding", String(err));
    }
  };

  return (
    <View style={styles.container}>
      <ProgressDots step={3} total={4} />

      <EditorialText kind="displayLg">Daily practice goal</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        How many minutes per day?
      </EditorialText>

      <View style={styles.pillsRow}>
        {GOAL_OPTIONS.map((m) => {
          const isSelected = selected === m;
          return (
            <Pressable
              key={m}
              onPress={() => setSelected(m)}
              style={styles.pillPressable}
            >
              {isSelected ? (
                <View style={styles.pillSelected}>
                  <EditorialText kind="bodyMd" color={palette.peach}>
                    {m} min
                  </EditorialText>
                </View>
              ) : (
                <GlassCard radiusToken="pill" padding="md">
                  <EditorialText kind="bodyMd" color={palette.ink}>
                    {m} min
                  </EditorialText>
                </GlassCard>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onFinish}
        disabled={mutation.isPending}
        style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          {mutation.isPending ? "Setting up…" : "Start practicing"}
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
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pillPressable: {
    minHeight: 44,
    justifyContent: "center",
  },
  pillSelected: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
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
