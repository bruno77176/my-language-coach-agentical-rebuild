import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
// @ts-expect-error react-native-confetti-cannon ships no bundled types
import ConfettiCannon from "react-native-confetti-cannon";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

const VICTORY_SOUND = require("@/assets/sounds/victory.mp3");

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!visible) return;

    // Play victory sound (best-effort)
    try {
      const player = createAudioPlayer(VICTORY_SOUND);
      playerRef.current = player;
      player.play();
    } catch {
      // ignore
    }

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHidden();
      playerRef.current?.remove();
      playerRef.current = null;
    });

    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, [visible, opacity, onHidden]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <ConfettiCannon
        count={100}
        origin={{ x: 180, y: 0 }}
        autoStart
        fadeOut
      />
      <Animated.View style={[styles.toast, { opacity }]}>
        <Text style={styles.toastText}>
          🎉 Goal hit! {streakDays} day{streakDays === 1 ? "" : "s"} in a row 🔥
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    zIndex: 999,
  },
  toast: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
