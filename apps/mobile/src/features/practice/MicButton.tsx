import { Pressable, StyleSheet, Text } from "react-native";

export type MicButtonProps = {
  onPress: () => void;
  isRecording: boolean;
  isBusy: boolean;
};

export function MicButton({ onPress, isRecording, isBusy }: MicButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isBusy}
      style={[
        styles.mic,
        isRecording && styles.micRecording,
        isBusy && styles.micDisabled,
      ]}
    >
      <Text style={styles.micIcon}>{isRecording ? "■" : "🎙"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  micRecording: { backgroundColor: "#dc2626" },
  micDisabled: { backgroundColor: "#9ca3af" },
  micIcon: { color: "#ffffff", fontSize: 28 },
});
