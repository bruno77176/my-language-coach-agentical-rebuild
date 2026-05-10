import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useProgressSummary } from "@/src/features/progress/use-progress-summary";
import { Heatmap } from "@/src/features/progress/heatmap";
import { StatsRow } from "@/src/features/progress/stats-row";

export default function ProgressScreen() {
  const { data, isLoading, error } = useProgressSummary();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Could not load your progress. Pull to refresh.
        </Text>
      </View>
    );
  }

  const isEmpty = data.days.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Progress</Text>
      <View style={styles.headerRow}>
        <Text style={styles.headerStat}>
          🔥 {data.current_streak}-day streak
        </Text>
        <Text style={styles.headerStat}>⏱ {data.total_minutes} min total</Text>
      </View>

      <Text style={styles.sectionLabel}>Last 12 weeks</Text>
      <Heatmap days={data.days} today={new Date()} />

      <View style={styles.spacer} />

      <StatsRow
        weekMinutes={data.week_minutes}
        longestStreak={data.longest_streak}
        totalSessions={data.total_sessions}
        totalMinutes={data.total_minutes}
      />

      {isEmpty ? (
        <Text style={styles.emptyHint}>
          Start practicing to fill in your first day.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: { padding: 24, paddingTop: 48, backgroundColor: "#ffffff" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerStat: { fontSize: 14, color: "#374151" },
  sectionLabel: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  spacer: { height: 24 },
  emptyHint: {
    marginTop: 16,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
  },
  errorText: { color: "#b91c1c", textAlign: "center" },
});
