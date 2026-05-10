import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopStatusBar(props: Props) {
  const goalSec = props.goalMinutes * 60;
  const goalHit = props.todaySeconds >= goalSec && goalSec > 0;
  const todayDisplay = formatMinSec(props.todaySeconds);
  const goalDisplay = `${props.goalMinutes}:00`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.left}>
          <Text style={[styles.timer, goalHit && styles.timerGoalHit]}>
            {goalHit
              ? `🎯 ${todayDisplay}`
              : `⏱ ${todayDisplay} / ${goalDisplay}`}
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
    </View>
  );
}

const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: STATUS_BAR_HEIGHT,
    backgroundColor: "#ffffff",
  },
  container: {
    height: 52,
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
