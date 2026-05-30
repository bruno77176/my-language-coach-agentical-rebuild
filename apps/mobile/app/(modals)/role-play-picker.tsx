import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ROLE_PLAY_SCENARIOS } from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { usePurchases } from "@/src/features/paywall/use-purchases";

export default function RolePlayPicker() {
  const { isPro } = usePurchases();
  const { data: profile } = useProfile();
  const nativeLang = (profile?.native_lang ?? "en") as "en" | "fr";

  const onPick = (id: string, locked: boolean) => {
    if (locked) {
      // Milestone 4 wires the paywall modal at /(modals)/paywall
      router.push("/(modals)/paywall");
      return;
    }
    router.replace({ pathname: "/(tabs)/practice", params: { scenarioId: id } });
  };

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Practice a scenario
        </EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft} style={styles.subtitle}>
          Pick a real-world situation. Your coach will play their role and throw in a twist.
        </EditorialText>
        {ROLE_PLAY_SCENARIOS.map((s) => {
          const locked = s.pro && !isPro;
          const title = s.title[nativeLang] ?? s.title.en;
          const desc = s.description[nativeLang] ?? s.description.en;
          return (
            <Pressable
              key={s.id}
              onPress={() => onPick(s.id, locked)}
              style={styles.row}
            >
              <View style={{ flex: 1 }}>
                <EditorialText kind="bodyMd" style={styles.rowTitle}>
                  {title} {locked ? "🔒" : ""}
                </EditorialText>
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  {desc}
                </EditorialText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.md },
  title: { color: palette.ink },
  subtitle: { marginBottom: spacing.lg },
  row: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: palette.ink, marginBottom: spacing.xs },
});
