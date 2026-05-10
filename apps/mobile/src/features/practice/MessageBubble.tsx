import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChatMessage } from "./types";
import { useTranslateMessage } from "./use-translate-message";
import { fetchMessageAudio } from "./api-message-audio";
import { playOnce } from "./audio-controller";

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

  const isSoftError = message.id.startsWith("soft-");
  const isGreeting = message.isGreeting === true;

  async function playAudio() {
    setPlayingAudio(true);
    try {
      let url: string | null | undefined;
      if (isUser || isGreeting || isSoftError) {
        url = message.audioUrl;
      } else {
        // Non-greeting coach message: fetch full-message audio (cached server-
        // side after first generation; per-chunk URLs only contain the LAST
        // sentence so we can't reuse them for full replay).
        try {
          const res = await fetchMessageAudio(message.id);
          url = res.audioUrl;
        } catch {
          url = message.audioUrl;
        }
      }
      if (!url) return;
      // Centralized playOnce: single-player rule + guaranteed cleanup with
      // hard timeout. Awaiting it makes the spinner stay visible for the
      // duration of playback.
      await playOnce({ source: { uri: url }, text: message.text });
    } catch {
      // best-effort
    } finally {
      setPlayingAudio(false);
    }
  }

  async function handleTranslatePress() {
    if (isUser || listeningMode || isSoftError) return;
    // Greetings have a hardcoded client translation set in useConversation.
    // Just toggle visibility — no API call.
    if (message.clientTranslation) {
      if (translation) {
        setShowingTranslation((s) => !s);
      } else {
        setTranslation(message.clientTranslation);
        setShowingTranslation(true);
      }
      return;
    }
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

  function handleBubblePress() {
    // In listening mode, tapping the bubble reveals + plays.
    if (showsAsListening) {
      onReveal(message.id);
      void playAudio();
    }
    // Otherwise, the bubble itself doesn't do anything — the per-icon Pressables
    // handle repeat (🔁) and translate (🌐). This avoids gesture conflicts and
    // makes the affordances obvious.
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
          {!isSoftError ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleRepeatPressWrapper}
                hitSlop={10}
                style={styles.actionTap}
              >
                <Text style={styles.actionIcon}>
                  {playingAudio ? "▶" : "🔁"}
                </Text>
              </Pressable>
              {!isUser && !listeningMode ? (
                <Pressable
                  onPress={handleTranslatePress}
                  hitSlop={10}
                  style={styles.actionTap}
                >
                  {translate.isPending ? (
                    <ActivityIndicator size="small" color="#6b7280" />
                  ) : (
                    <Text
                      style={[
                        styles.actionIcon,
                        showingTranslation && styles.actionIconActive,
                      ]}
                    >
                      🌐
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  function handleRepeatPressWrapper() {
    void playAudio();
  }

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
    gap: 16,
    marginTop: 6,
  },
  actionTap: { padding: 4 },
  actionIcon: { fontSize: 16, color: "#6b7280" },
  actionIconActive: { color: "#1d4ed8" },
});
