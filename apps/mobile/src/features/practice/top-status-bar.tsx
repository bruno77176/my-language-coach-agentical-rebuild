import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { EditorialText, GlassCard } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import { ShareButton } from "./share-button";
import type { TranscriptMessage } from "./build-transcript";
import avatarLottie from "../../../assets/avatar.json";

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
};

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopStatusBar(props: Props) {
  const insets = useSafeAreaInsets();
  const goalSec = props.goalMinutes * 60;
  const goalHit = props.todaySeconds >= goalSec && goalSec > 0;
  const todayDisplay = formatMinSec(props.todaySeconds);
  const goalDisplay = `${props.goalMinutes}:00`;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg },
      ]}
    >
      {/* Left: animated avatar + timer pill */}
      <GlassCard radiusToken="pill" padding="sm" style={styles.timerPill}>
        <LottieView source={avatarLottie} autoPlay loop style={styles.avatar} />
        <EditorialText
          kind="bodyMd"
          color={goalHit ? palette.accent : palette.ink}
          style={styles.timerText}
        >
          {todayDisplay}
        </EditorialText>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {`/ ${goalDisplay}`}
        </EditorialText>
      </GlassCard>

      {/* Right: listening toggle + share + exit */}
      <View style={styles.rightRow}>
        <Pressable onPress={props.onToggleListening} hitSlop={8}>
          <GlassCard radiusToken="pill" padding="xs" style={styles.iconButton}>
            <Ionicons
              name={props.listeningMode ? "headset" : "eye-outline"}
              size={16}
              color={props.listeningMode ? palette.accent : palette.ink}
            />
          </GlassCard>
        </Pressable>

        <ShareButton
          languageCode={props.shareLanguageCode}
          startedAt={props.shareStartedAt}
          durationMinutes={props.shareDurationMinutes}
          messages={props.shareMessages}
        />

        {/* End action moved to a bottom CTA + auto-save flow.
            See EndSessionCTA + use-stale-session-guard. */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    zIndex: 10,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  avatar: { width: 28, height: 28 },
  timerText: { fontWeight: "600" },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
