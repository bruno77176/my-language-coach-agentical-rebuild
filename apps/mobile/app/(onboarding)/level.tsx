import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES, PROFICIENCY_LEVELS } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { GlassCard, EditorialText } from "@/src/design";
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

// The "not sure" choice — leaves the level unset so the coach infers it from
// conversation (today's behavior). Value "" maps to NULL server-side.
const UNSURE = {
  code: "",
  label: "I'm not sure",
  blurb: "Let the coach figure it out",
};
const OPTIONS = [...PROFICIENCY_LEVELS, UNSURE];

function LevelCard({
  label,
  cefr,
  blurb,
  selected,
  onPress,
}: {
  label: string;
  cefr?: string;
  blurb: string;
  selected: boolean;
  onPress: () => void;
}) {
  const body = (
    <View style={styles.cardRow}>
      <View style={{ flex: 1 }}>
        <EditorialText
          kind="bodyLg"
          color={selected ? palette.peach : palette.ink}
        >
          {label}
          {cefr ? (
            <EditorialText
              kind="bodyMd"
              color={selected ? palette.peach : palette.inkSoft}
            >
              {"  ·  " + cefr}
            </EditorialText>
          ) : null}
        </EditorialText>
        <EditorialText
          kind="bodySm"
          color={selected ? palette.peach : palette.inkSoft}
        >
          {blurb}
        </EditorialText>
      </View>
    </View>
  );
  return (
    <Pressable onPress={onPress} style={styles.cardPressable}>
      {selected ? (
        <View style={styles.cardSelected}>{body}</View>
      ) : (
        <GlassCard radiusToken="lg" padding="base">
          {body}
        </GlassCard>
      )}
    </Pressable>
  );
}

export default function LevelStep() {
  const targetLang = useOnboardingStore((s) => s.targetLang);
  const initial = useOnboardingStore((s) => s.selfDeclaredLevel);
  const setSelfDeclaredLevel = useOnboardingStore(
    (s) => s.setSelfDeclaredLevel,
  );
  const [selected, setSelected] = useState(initial);

  const langName =
    LANGUAGES.find((l) => l.code === targetLang)?.englishName ??
    "this language";

  const onContinue = () => {
    setSelfDeclaredLevel(selected);
    router.push("/(onboarding)/daily-goal");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ProgressDots step={3} total={5} />
        <EditorialText kind="displayLg">
          How well do you speak {langName}?
        </EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          This helps the coach pitch things at your level. You can change it
          anytime.
        </EditorialText>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {OPTIONS.map((o) => (
          <LevelCard
            key={o.code || "unsure"}
            label={o.label}
            cefr={o.code || undefined}
            blurb={o.blurb}
            selected={selected === o.code}
            onPress={() => setSelected(o.code)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onContinue} style={styles.cta}>
          <EditorialText kind="bodyLg" color={palette.peach}>
            Continue
          </EditorialText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.base,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing.base,
  },
  cardPressable: { minHeight: 44 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardSelected: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
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
});
