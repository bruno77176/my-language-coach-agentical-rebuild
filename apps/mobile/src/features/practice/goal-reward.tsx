import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { EditorialText, FadeInView } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import avatarLottie from "../../../assets/avatar.json";
import { playOnce } from "./audio-controller";

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VICTORY_SOUND = require("../../../assets/sounds/victory.mp3");

/**
 * Goal-reached celebration. A small, non-blocking toast that drops in at the
 * top of the practice screen WITHOUT interrupting the conversation (BRU-28):
 * the overlay is `pointerEvents="box-none"` so taps fall through to the chat,
 * and only the toast pill itself is tappable (to dismiss early). Keeps the
 * confetti + victory sound; uses a small avatar that fits the pill.
 */
export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (!visible) return;
    // Route through audio-controller so the iOS session is flipped to playback
    // first (matters if reward fires right after a recording ends).
    void playOnce({ source: VICTORY_SOUND });
    confettiRef.current?.start();
    const t = setTimeout(onHidden, 3500);
    return () => clearTimeout(t);
  }, [visible, onHidden]);

  if (!visible) return null;

  return (
    // box-none: the overlay never blocks touches — the conversation stays live.
    <View style={styles.overlay} pointerEvents="box-none">
      <FadeInView style={styles.toastWrap}>
        <Pressable style={styles.toast} onPress={onHidden}>
          <LottieView
            source={avatarLottie}
            autoPlay
            loop={false}
            style={styles.avatar}
          />
          <View style={styles.textCol}>
            <EditorialText kind="bodyLg" italic style={styles.title}>
              {"✿ Goal hit"}
            </EditorialText>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              {streakDays}-day streak
            </EditorialText>
          </View>
        </Pressable>
      </FadeInView>
      {/* Confetti is purely decorative — never intercept touches. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ConfettiCannon
          ref={confettiRef}
          count={90}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          colors={[palette.accent, palette.coral, palette.peach, palette.mauve]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  toastWrap: { marginTop: spacing.xl },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.cream,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    ...shadow.cta,
  },
  avatar: { width: 44, height: 44 },
  textCol: { paddingRight: spacing.sm },
  title: { color: palette.ink },
});
