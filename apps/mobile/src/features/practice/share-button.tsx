import { Pressable, Share, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/src/design";
import { palette } from "@language-coach/design-tokens";
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
    try {
      // Full transcript as text — carries the entire conversation and a tappable
      // app link (an image truncated it and the link wasn't clickable).
      await Share.share({ message: buildTranscript(props) });
    } catch {
      // user cancelled or system error — nothing to do
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <GlassCard radiusToken="pill" padding="xs" style={styles.button}>
        <Ionicons name="share-social-outline" size={16} color={palette.ink} />
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: { opacity: 0.3 },
});
