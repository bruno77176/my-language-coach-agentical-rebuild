import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bubble, EditorialText } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import type { ChatMessage } from "./types";
import { useTranslateMessage } from "./use-translate-message";
import { fetchMessageAudio } from "./api-message-audio";
import { playOnce } from "./audio-controller";

// One-time hint shown under the first greeting so users discover that any word
// the coach says can be tapped to save it to the deck (BRU-27 discoverability).
const TAP_HINT_KEY = "vocab-tap-hint.v1";

// Strip surrounding punctuation/quotes so tapping "Tisch." saves "Tisch".
function cleanWord(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

type Props = {
  message: ChatMessage;
  listeningMode: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
  languageCode: string;
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
  languageCode,
}: Props) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const translate = useTranslateMessage();

  const showsAsListening = listeningMode && !revealed;

  const isSoftError = message.id.startsWith("soft-");
  const isGreeting = message.isGreeting === true;
  // Coach text (not listening placeholder, not an error bubble) gets per-word
  // tap-to-save. User messages stay plain.
  const wordsTappable = !isUser && !showsAsListening && !isSoftError;

  // Surface the tap-to-save hint once, anchored to the greeting.
  useEffect(() => {
    if (!isGreeting) return;
    let active = true;
    void AsyncStorage.getItem(TAP_HINT_KEY).then((seen) => {
      if (active && !seen) setShowTapHint(true);
    });
    return () => {
      active = false;
    };
  }, [isGreeting]);

  function dismissTapHint() {
    setShowTapHint(false);
    void AsyncStorage.setItem(TAP_HINT_KEY, "1");
  }

  function openSaveWord(rawWord: string) {
    const word = cleanWord(rawWord);
    if (!word) return;
    if (showTapHint) dismissTapHint();
    router.push({
      pathname: "/(modals)/add-vocab",
      params: {
        prefill: word,
        language: languageCode,
        source: message.text,
      },
    });
  }

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

  function handleLongPress() {
    // Long-press saves the WHOLE phrase (tapping a single word saves just that
    // word). Either way the source sentence travels along for in-context review.
    if (isSoftError || showsAsListening) return;
    router.push({
      pathname: "/(modals)/add-vocab",
      params: {
        prefill: message.text,
        language: languageCode,
        source: message.text,
      },
    });
  }

  const textColor = isUser ? palette.peach : palette.ink;
  const listeningColor = isUser ? palette.peach : palette.inkSoft;

  const Inner = (
    <Bubble variant={isUser ? "you" : "coach"}>
      {showsAsListening ? (
        <View style={styles.listeningRow}>
          <Ionicons name="headset" size={18} color={listeningColor} />
          <EditorialText kind="bodyMd" color={listeningColor}>
            {formatDuration(message.audioDurationMs)}
          </EditorialText>
        </View>
      ) : (
        <>
          <EditorialText kind="bodyLg" color={textColor}>
            {wordsTappable
              ? message.text.split(/(\s+)/).map((tok, i) =>
                  tok.trim() === "" ? (
                    tok
                  ) : (
                    <Text
                      key={i}
                      onPress={() => openSaveWord(tok)}
                      suppressHighlighting
                    >
                      {tok}
                    </Text>
                  ),
                )
              : message.text}
          </EditorialText>
          {showTapHint ? (
            <Pressable onPress={dismissTapHint} style={styles.tapHint}>
              <Ionicons
                name="hand-left-outline"
                size={13}
                color={palette.accent}
              />
              <EditorialText kind="bodySm" color={palette.inkSoft}>
                Tip: tap any word to save it to your deck
              </EditorialText>
            </Pressable>
          ) : null}
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
    <Pressable
      onPress={handleBubblePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      style={styles.messageRow}
    >
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
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
