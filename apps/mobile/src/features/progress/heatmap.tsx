import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import type { ProgressDay } from "./use-progress-summary";

type Props = {
  days: ProgressDay[];
  today: Date;
};

const TOTAL_CELLS = 84; // 12 weeks × 7 days

const LEVEL_COLORS = [
  palette.glassFaint, // L0: no practice
  "rgba(217,107,91,0.25)", // L1: 1-33% of goal
  "rgba(217,107,91,0.45)", // L2: 33-66%
  "rgba(217,107,91,0.7)", // L3: 66-99%
  palette.accent, // L4: goal hit ≥100%
] as const;

function cellColor(day: ProgressDay | undefined): string {
  if (!day || day.seconds_spoken === 0) return LEVEL_COLORS[0];
  if (day.goal_reached) return LEVEL_COLORS[4];
  // Intermediate: bucket seconds_spoken into L1/L2/L3.
  // Without the goal value in seconds we approximate by thirds of a 5-min goal (300 s).
  // Any practice < 100 s → L1, 100–199 → L2, 200+ → L3.
  const s = day.seconds_spoken;
  if (s < 100) return LEVEL_COLORS[1];
  if (s < 200) return LEVEL_COLORS[2];
  return LEVEL_COLORS[3];
}

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
              style={[styles.cell, { backgroundColor: cellColor(day) }]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.cell, { backgroundColor: LEVEL_COLORS[0] }]} />
        <Text style={styles.legendText}>none</Text>
        <View style={[styles.cell, { backgroundColor: LEVEL_COLORS[2] }]} />
        <Text style={styles.legendText}>some</Text>
        <View style={[styles.cell, { backgroundColor: LEVEL_COLORS[4] }]} />
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
  cell: { width: CELL, height: CELL, aspectRatio: 1, borderRadius: radius.sm },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
  },
  legendText: { fontSize: 12, color: palette.inkSoft, marginRight: 8 },
});
