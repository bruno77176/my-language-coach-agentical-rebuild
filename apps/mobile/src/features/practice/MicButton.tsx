import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, shadow } from "@language-coach/design-tokens";

export type MicButtonProps = {
  onPress: () => void;
  isRecording: boolean;
  isBusy: boolean;
};

export function MicButton({ onPress, isRecording, isBusy }: MicButtonProps) {
  const bgColor = isBusy
    ? palette.glassStrong
    : isRecording
      ? palette.accent
      : palette.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBusy}
      style={[styles.mic, { backgroundColor: bgColor }]}
    >
      {isBusy ? (
        <ActivityIndicator size="small" color={palette.ink} />
      ) : isRecording ? (
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
  stopSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: palette.peach,
  },
});
