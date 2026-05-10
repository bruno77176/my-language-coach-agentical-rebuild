import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShareButton } from "./share-button";
import type { TranscriptMessage } from "./build-transcript";

type Props = {
  todaySeconds: number;
  goalMinutes: number;
  streakDays: number;
  listeningMode: boolean;
  onToggleListening: () => void;
  shareLanguageCode: string;
  shareStartedAt: Date;
  shareDurationMinutes: number;
  shareMessages: TranscriptMessage[];
  onExit: () => void;
};

export function TopStatusBar(props: Props) {
  const todayMin = Math.floor(props.todaySeconds / 60);
  const goalSec = props.goalMinutes * 60;
  const goalHit = props.todaySeconds >= goalSec && goalSec > 0;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={[styles.timer, goalHit && styles.timerGoalHit]}>
          {goalHit
            ? `🎯 ${todayMin} min`
            : `⏱ ${todayMin}/${props.goalMinutes} min`}
        </Text>
        {props.streakDays > 0 ? (
          <Text style={styles.streak}>🔥 {props.streakDays}</Text>
        ) : null}
        <Pressable
          onPress={props.onToggleListening}
          hitSlop={10}
          style={styles.toggle}
        >
          <Text style={styles.toggleIcon}>
            {props.listeningMode ? "🎧" : "👁"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.right}>
        <ShareButton
          languageCode={props.shareLanguageCode}
          startedAt={props.shareStartedAt}
          durationMinutes={props.shareDurationMinutes}
          messages={props.shareMessages}
        />
        <Pressable onPress={props.onExit} style={styles.exitButton}>
          <Text style={styles.exitText}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  timer: { fontSize: 13, color: "#374151", fontWeight: "600" },
  timerGoalHit: { color: "#059669" },
  streak: { fontSize: 13, color: "#374151" },
  toggle: { padding: 4 },
  toggleIcon: { fontSize: 16 },
  exitButton: { paddingHorizontal: 12, paddingVertical: 6 },
  exitText: { color: "#2563eb", fontWeight: "600" },
});
