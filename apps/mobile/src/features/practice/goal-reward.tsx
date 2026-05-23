import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { EditorialText, FadeInView, Screen } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import avatarLottie from "../../../assets/avatar.json";
import { playOnce } from "./audio-controller";

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VICTORY_SOUND = require("../../../assets/sounds/victory.mp3");

export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (!visible) return;
    // Route through audio-controller so the iOS session is flipped to playback
    // first (matters if reward fires right after a recording ends).
    void playOnce({ source: VICTORY_SOUND });
    confettiRef.current?.start();
    const t = setTimeout(onHidden, 4000);
    return () => clearTimeout(t);
  }, [visible, onHidden]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Screen variant="gradient" edgeToEdge>
        <Pressable style={styles.overlay} onPress={onHidden}>
          <FadeInView style={styles.content}>
            <LottieView
              source={avatarLottie}
              autoPlay
              loop={false}
              style={styles.avatar}
            />
            <EditorialText
              kind="displayXl"
              italic
              align="center"
              style={styles.title}
            >
              {"✿ Goal hit"}
            </EditorialText>
            <EditorialText
              kind="bodyLg"
              color={palette.inkSoft}
              align="center"
              style={styles.streak}
            >
              {streakDays}-day streak
            </EditorialText>
          </FadeInView>
        </Pressable>
        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          colors={[palette.accent, palette.coral, palette.peach, palette.mauve]}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center", padding: spacing.xl },
  avatar: { width: 200, height: 200 },
  title: { marginTop: spacing.md },
  streak: { marginTop: spacing.sm },
});
