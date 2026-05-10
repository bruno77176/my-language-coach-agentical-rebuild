import { StyleSheet, Text, View } from "react-native";

type Props = {
  weekMinutes: number;
  longestStreak: number;
  totalSessions: number;
  totalMinutes: number;
};

export function StatsRow(props: Props) {
  const rows: [string, string][] = [
    ["This week", `${props.weekMinutes} min`],
    ["Best streak", `${props.longestStreak} days`],
    ["Sessions total", `${props.totalSessions}`],
    ["Total minutes", `${props.totalMinutes}`],
  ];
  return (
    <View style={styles.container}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  label: { fontSize: 14, color: "#374151" },
  value: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
