import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createAudioPlayer } from "expo-audio";
import type { ChatMessage } from "./types";
import { useTranslateMessage } from "./use-translate-message";
import { fetchMessageAudio } from "./api-message-audio";

type Props = {
  message: ChatMessage;
  listeningMode: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
};

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "0:00";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MessageBubble({
  message,
  listeningMode,
  revealed,
  onReveal,
}: Props) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const translate = useTranslateMessage();

  const showsAsListening = listeningMode && !revealed;

  async function playAudio() {
    setPlayingAudio(true);
    try {
      let url = message.audioUrl;
      if (!url && !isUser) {
        const res = await fetchMessageAudio(message.id);
        url = res.audioUrl;
      }
      if (!url) return;
      const player = createAudioPlayer({ uri: url });
      player.play();
    } catch {
      // best-effort
    } finally {
      setPlayingAudio(false);
    }
  }

  async function handleBubblePress() {
    if (showsAsListening) {
      onReveal(message.id);
      void playAudio();
      return;
    }
    if (isUser) return;
    if (translation) {
      setShowingTranslation((s) => !s);
      return;
    }
    try {
      const res = await translate.mutateAsync(message.id);
      setTranslation(res.translation);
      setShowingTranslation(true);
    } catch {
      // best-effort
    }
  }

  function handleRepeatPress() {
    void playAudio();
  }

  const Inner = (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}
    >
      {showsAsListening ? (
        <View style={styles.listeningRow}>
          <Text style={styles.listeningIcon}>🎧</Text>
          <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
            {formatDuration(message.audioDurationMs)}
          </Text>
        </View>
      ) : (
        <>
          <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
            {message.text}
          </Text>
          {!isUser && showingTranslation && translation ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.translation}>{translation}</Text>
            </>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable onPress={handleRepeatPress} hitSlop={8}>
              <Text style={styles.actionIcon}>{playingAudio ? "▶" : "🔁"}</Text>
            </Pressable>
            {!isUser && !listeningMode ? (
              <View>
                {translate.isPending ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  <Text style={styles.actionIcon}>🌐</Text>
                )}
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );

  return <Pressable onPress={handleBubblePress}>{Inner}</Pressable>;
}

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: "85%",
  },
  bubbleUser: {
    backgroundColor: "#dbeafe",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  bubbleCoach: {
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  bubbleUserText: { color: "#111827", fontSize: 16 },
  bubbleCoachText: { color: "#111827", fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#9ca3af",
    marginVertical: 8,
  },
  translation: { fontSize: 14, color: "#4b5563", fontStyle: "italic" },
  listeningRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  listeningIcon: { fontSize: 18 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  actionIcon: { fontSize: 14, color: "#9ca3af" },
});
