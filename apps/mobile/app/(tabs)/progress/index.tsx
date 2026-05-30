import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useProgressSummary } from "@/src/features/progress/use-progress-summary";
import { Heatmap } from "@/src/features/progress/heatmap";
import { StatsRow } from "@/src/features/progress/stats-row";
import { EditorialText, Screen, TAB_BAR_RESERVE } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";

export default function ProgressScreen() {
  const { data, isLoading, error } = useProgressSummary();

  if (isLoading) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <ActivityIndicator color={palette.ink} />
        </View>
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <EditorialText kind="bodyMd" color={palette.danger} align="center">
            Could not load your progress. Pull to refresh.
          </EditorialText>
        </View>
      </Screen>
    );
  }

  const isEmpty = data.days.length === 0;

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <EditorialText kind="displayLg">Progress</EditorialText>
          <View style={styles.streakPill}>
            <EditorialText kind="bodySm" color={palette.peach}>
              🔥 {data.current_streak}
            </EditorialText>
          </View>
        </View>

        <EditorialText kind="caps" color={palette.inkSoft} style={styles.label}>
          Last 12 weeks
        </EditorialText>
        <Heatmap days={data.days} today={new Date()} />

        <View style={styles.spacer} />

        <StatsRow
          weekMinutes={data.week_minutes}
          longestStreak={data.longest_streak}
          totalSessions={data.total_sessions}
          totalMinutes={data.total_minutes}
        />

        {isEmpty ? (
          <View style={styles.empty}>
            <EditorialText
              kind="displayMd"
              italic
              align="center"
              color={palette.inkSoft}
            >
              Your first day starts today.
            </EditorialText>
            <EditorialText
              kind="bodySm"
              align="center"
              color={palette.inkSoft}
              style={{ marginTop: spacing.md, opacity: 0.7 }}
            >
              Open Practice, talk for a minute, watch this fill in.
            </EditorialText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  container: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: TAB_BAR_RESERVE + spacing.xl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakPill: {
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minHeight: 28,
    justifyContent: "center",
  },
  label: { marginTop: spacing.sm },
  spacer: { height: spacing.sm },
  empty: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
});
