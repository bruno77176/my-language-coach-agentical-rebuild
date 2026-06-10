import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LANGUAGES } from "@language-coach/shared";
import { GlassCard } from "@/src/design";
import { palette } from "@language-coach/design-tokens";
import { buildTranscript, type TranscriptMessage } from "./build-transcript";
import { ShareCardModal } from "@/src/features/sharing/share-card-modal";
import { ConversationShareCard } from "@/src/features/sharing/share-cards";

type Props = {
  languageCode: string;
  startedAt: Date;
  durationMinutes: number;
  messages: TranscriptMessage[];
};

export function ShareButton(props: Props) {
  const [open, setOpen] = useState(false);
  const disabled = props.messages.length === 0;
  const langName =
    LANGUAGES.find((l) => l.code === props.languageCode)?.englishName ??
    props.languageCode;

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        hitSlop={8}
        style={disabled && styles.disabled}
      >
        <GlassCard radiusToken="pill" padding="xs" style={styles.button}>
          <Ionicons name="share-social-outline" size={16} color={palette.ink} />
        </GlassCard>
      </Pressable>
      <ShareCardModal
        visible={open}
        onClose={() => setOpen(false)}
        caption={buildTranscript(props)}
      >
        <ConversationShareCard
          languageName={langName}
          durationMinutes={props.durationMinutes}
        />
      </ShareCardModal>
    </>
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
