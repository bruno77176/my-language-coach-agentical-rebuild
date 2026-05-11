import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Bubble, EditorialText } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
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
    // handle repeat and translate. This avoids gesture conflicts and
    // makes the affordances obvious.
  }

  function handleRepeatPressWrapper() {
    void playAudio();
  }

  const textColor = isUser ? palette.peach : palette.ink;

  const Inner = (
    <Bubble variant={isUser ? "you" : "coach"}>
      {showsAsListening ? (
        <View style={styles.listeningRow}>
          <Ionicons name="headset" size={18} color={palette.inkSoft} />
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            {formatDuration(message.audioDurationMs)}
          </EditorialText>
        </View>
      ) : (
        <>
          <EditorialText kind="bodyLg" color={textColor}>
            {message.text}
          </EditorialText>
          {!isUser && showingTranslation && translation ? (
            <>
              <View style={styles.divider} />
              <EditorialText
                kind="bodySm"
                italic
                color={isUser ? palette.coral : palette.inkSoft}
              >
                {translation}
              </EditorialText>
            </>
          ) : null}
          {!isSoftError ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleRepeatPressWrapper}
                hitSlop={10}
                style={styles.actionTap}
              >
                {playingAudio ? (
                  <ActivityIndicator
                    size="small"
                    color={isUser ? palette.peach : palette.inkSoft}
                  />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={14}
                    color={isUser ? palette.coral : palette.inkSoft}
                  />
                )}
              </Pressable>
              {!isUser && !listeningMode ? (
                <Pressable
                  onPress={handleTranslatePress}
                  hitSlop={10}
                  style={styles.actionTap}
                >
                  {translate.isPending ? (
                    <ActivityIndicator size="small" color={palette.inkSoft} />
                  ) : (
                    <Ionicons
                      name="language"
                      size={14}
                      color={
                        showingTranslation ? palette.accent : palette.inkSoft
                      }
                    />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Bubble>
  );

  return (
    <Pressable onPress={handleBubblePress} style={styles.messageRow}>
      {Inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    marginVertical: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.inkSoft,
    opacity: 0.2,
    marginVertical: spacing.sm,
  },
  listeningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  actionTap: { padding: spacing.xs },
});
