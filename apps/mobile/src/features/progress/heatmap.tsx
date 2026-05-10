import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProgressDay } from "./use-progress-summary";

type Props = {
  days: ProgressDay[];
  today: Date;
};

const TOTAL_CELLS = 84; // 12 weeks × 7 days

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildGrid(today: Date): string[] {
  // Returns 84 ISO date strings, oldest first.
  const dates: string[] = [];
  for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(isoDate(d));
  }
  return dates;
}

export function Heatmap({ days, today }: Props) {
  const dayMap = new Map<string, ProgressDay>(days.map((d) => [d.date, d]));
  const grid = buildGrid(today);

  return (
    <View style={styles.gridContainer}>
      <View style={styles.grid}>
        {grid.map((iso) => {
          const day = dayMap.get(iso);
          const intensity = day
            ? day.goal_reached
              ? "hit"
              : "some"
            : "none";
          const label = day
            ? day.goal_reached
              ? `${iso} ${Math.floor(day.seconds_spoken / 60)} min, goal hit`
              : `${iso} ${Math.floor(day.seconds_spoken / 60)} min, some practice`
            : `${iso} no practice`;
          return (
            <Pressable
              key={iso}
              testID={`heatmap-cell-${iso}`}
              accessibilityLabel={label}
              onPress={() => Alert.alert(iso, label)}
              style={[styles.cell, styles[intensity]]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.cell, styles.none]} />
        <Text style={styles.legendText}>none</Text>
        <View style={[styles.cell, styles.some]} />
        <Text style={styles.legendText}>some</Text>
        <View style={[styles.cell, styles.hit]} />
        <Text style={styles.legendText}>goal hit</Text>
      </View>
    </View>
  );
}

const CELL = 14;
const GAP = 3;

const styles = StyleSheet.create({
  gridContainer: { width: "100%", alignItems: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 12 * (CELL + GAP),
    gap: GAP,
  },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  none: { backgroundColor: "#e5e7eb" },
  some: { backgroundColor: "#bfdbfe" },
  hit: { backgroundColor: "#1d4ed8" },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  legendText: { fontSize: 12, color: "#6b7280", marginRight: 8 },
});
