import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VICTORY_SOUND = require("@/assets/sounds/victory.mp3") as number;

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

/**
 * Non-animated celebration banner. Plays a victory sound and shows a green
 * banner for ~3s, then auto-dismisses via onHidden().
 *
 * (We dropped react-native-confetti-cannon — it shipped with a React-version
 * mismatch that caused "useReducer of null" render errors in this monorepo.)
 */
export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (!visible) return;

    function stopPlayer() {
      if (!playerRef.current) return;
      try {
        playerRef.current.pause();
      } catch {
        // ignore
      }
      try {
        playerRef.current.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }

    try {
      const player = createAudioPlayer(VICTORY_SOUND);
      playerRef.current = player;
      player.play();
    } catch {
      // best-effort — sound failure is non-blocking
    }

    timeoutRef.current = setTimeout(() => {
      onHiddenRef.current();
      stopPlayer();
      timeoutRef.current = null;
    }, 3000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      stopPlayer();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.toast}>
        <Text style={styles.toastEmoji}>🎉</Text>
        <Text style={styles.toastText}>
          Goal hit! {streakDays} day{streakDays === 1 ? "" : "s"} in a row 🔥
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 80,
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastEmoji: { fontSize: 22 },
  toastText: { color: "#ffffff", fontSize: 15, fontWeight: "700", flexShrink: 1 },
});
