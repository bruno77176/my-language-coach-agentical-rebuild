import { Pressable, Share, StyleSheet, Text } from "react-native";
import { buildTranscript, type TranscriptMessage } from "./build-transcript";

type Props = {
  languageCode: string;
  startedAt: Date;
  durationMinutes: number;
  messages: TranscriptMessage[];
};

export function ShareButton(props: Props) {
  const disabled = props.messages.length === 0;

  async function handlePress() {
    if (disabled) return;
    const transcript = buildTranscript(props);
    try {
      await Share.share({ message: transcript });
    } catch {
      // user cancelled or system error — nothing to do
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
      hitSlop={10}
    >
      <Text style={styles.icon}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 8 },
  disabled: { opacity: 0.3 },
  icon: { fontSize: 20, color: "#2563eb" },
});
