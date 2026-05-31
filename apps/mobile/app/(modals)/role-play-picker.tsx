import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROLE_PLAY_SCENARIOS } from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { usePurchases } from "@/src/features/paywall/use-purchases";

export default function RolePlayPicker() {
  const insets = useSafeAreaInsets();
  const { isPro } = usePurchases();
  const { data: profile } = useProfile();
  const nativeLang = (profile?.native_lang ?? "en") as "en" | "fr";

  const onPick = (id: string, locked: boolean) => {
    if (locked) {
      router.push("/(modals)/paywall");
      return;
    }
    router.replace({
      pathname: "/(tabs)/practice",
      params: { scenarioId: id },
    });
  };

  const onClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/practice");
    }
  };

  return (
    <Screen variant="gradient">
      {/* Close button — Bruno flagged that this screen had no way out */}
      <Pressable
        onPress={onClose}
        style={[styles.closeButton, { top: insets.top + spacing.md }]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={28} color={palette.ink} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 64 }]}
      >
        <EditorialText kind="displayMd" italic style={styles.title}>
          Practice a scenario
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.subtitle}
        >
          Real-life conversation with a stranger — they&apos;re not there to
          help you with your language, but they can still be friendly.
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
              <View style={styles.iconWrap}>
                <Ionicons
                  name={s.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={locked ? palette.inkSoft : palette.ink}
                />
              </View>
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
  closeButton: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { padding: spacing.xl, gap: spacing.md },
  title: { color: palette.ink },
  subtitle: { marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: palette.ink, marginBottom: spacing.xs },
});
