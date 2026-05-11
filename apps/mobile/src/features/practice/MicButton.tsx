import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, shadow } from "@language-coach/design-tokens";

export type MicButtonProps = {
  onPress: () => void;
  isRecording: boolean;
  isBusy: boolean;
};

export function MicButton({ onPress, isRecording, isBusy }: MicButtonProps) {
  // Busy state stays as the ink mic but dimmed — the "Coach is thinking…" pill
  // above the mic already communicates the loading state. Two spinners stacked
  // (mic + pill) was confusing.
  const bgColor = isRecording ? palette.accent : palette.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBusy}
      style={[styles.mic, { backgroundColor: bgColor }, isBusy && styles.busy]}
    >
      {isRecording ? (
        <View style={styles.stopSquare} />
      ) : (
        <Ionicons name="mic" size={28} color={palette.peach} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.cta,
  },
  busy: { opacity: 0.5 },
  stopSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: palette.peach,
  },
});
