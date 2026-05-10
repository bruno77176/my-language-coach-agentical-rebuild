import { StyleSheet, Text, View } from "react-native";

type Props = {
  secondsSpoken: number;
  dailyGoalMinutes: number;
};

export function TodayProgress({ secondsSpoken, dailyGoalMinutes }: Props) {
  const goalSeconds = dailyGoalMinutes * 60;
  const minutes = Math.floor(secondsSpoken / 60);
  const ratio = Math.min(1, goalSeconds === 0 ? 0 : secondsSpoken / goalSeconds);
  const goalHit = secondsSpoken >= goalSeconds && goalSeconds > 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.caption, goalHit && styles.captionHit]}>
        {goalHit
          ? "🎯 Goal hit — keep going!"
          : `${minutes} / ${dailyGoalMinutes} min today`}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${ratio * 100}%` },
            goalHit && styles.barFillHit,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginVertical: 16 },
  caption: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 6,
  },
  captionHit: { color: "#059669", fontWeight: "600" },
  barTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  barFillHit: { backgroundColor: "#10b981" },
});
