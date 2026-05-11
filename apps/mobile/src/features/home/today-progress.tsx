import { StyleSheet, View } from "react-native";
import { palette, spacing } from "@language-coach/design-tokens";
import { EditorialText, GlassCard, Ring } from "@/src/design";

type Props = {
  secondsSpoken: number;
  dailyGoalMinutes: number;
};

export function TodayProgress({ secondsSpoken, dailyGoalMinutes }: Props) {
  const goalSeconds = dailyGoalMinutes * 60;
  const progress = goalSeconds > 0 ? secondsSpoken / goalSeconds : 0;
  const minutes = Math.floor(secondsSpoken / 60);
  const reached = progress >= 1;

  return (
    <GlassCard padding="md" radiusToken="lg">
      <View style={styles.row}>
        <Ring progress={progress} size={64} stroke={6} label={`${minutes}′`} />
        <View style={styles.text}>
          <EditorialText kind="bodyLg" color={palette.ink} style={styles.bold}>
            {minutes} of {dailyGoalMinutes} minutes
          </EditorialText>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {reached ? "Goal hit ✿" : "Keep going to hit today’s goal"}
          </EditorialText>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  text: { flex: 1 },
  bold: { fontWeight: "600" },
});
