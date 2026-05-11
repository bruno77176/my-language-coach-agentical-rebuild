import { StyleSheet, View } from "react-native";
import { palette, spacing } from "@language-coach/design-tokens";
import { EditorialText, GlassCard } from "@/src/design";

type Props = {
  weekMinutes: number;
  longestStreak: number;
  totalSessions: number;
  totalMinutes: number;
};

type StatCard = {
  label: string;
  value: string | number;
  unit?: string;
};

export function StatsRow(props: Props) {
  const cards: StatCard[] = [
    { label: "This week", value: props.weekMinutes, unit: "min" },
    { label: "Best streak", value: `${props.longestStreak} days` },
    { label: "Sessions", value: props.totalSessions },
    { label: "Total minutes", value: props.totalMinutes, unit: "min" },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <GlassCard
          key={card.label}
          padding="md"
          radiusToken="md"
          style={styles.card}
        >
          <View style={styles.valueRow}>
            <EditorialText kind="displayMd" color={palette.ink}>
              {card.value}
            </EditorialText>
            {card.unit ? (
              <EditorialText
                kind="bodySm"
                color={palette.inkSoft}
                style={styles.unit}
              >
                {card.unit}
              </EditorialText>
            ) : null}
          </View>
          <EditorialText kind="caps" color={palette.inkSoft}>
            {card.label}
          </EditorialText>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minWidth: "47%",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  unit: {
    marginBottom: 3,
  },
});
