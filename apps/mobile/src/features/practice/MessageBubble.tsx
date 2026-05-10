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

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const translate = useTranslateMessage();

  async function handlePress() {
    if (isUser) return;
    if (translation) {
      setShowing((s) => !s);
      return;
    }
    try {
      const res = await translate.mutateAsync(message.id);
      setTranslation(res.translation);
      setShowing(true);
    } catch {
      // best-effort — user can retry by tapping again
    }
  }

  const Inner = (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}
    >
      <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
        {message.text}
      </Text>
      {!isUser && showing && translation ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.translation}>{translation}</Text>
        </>
      ) : null}
      {!isUser && !showing && !translate.isPending ? (
        <Text style={styles.hint}>🌐</Text>
      ) : null}
      {translate.isPending ? (
        <ActivityIndicator
          size="small"
          color="#6b7280"
          style={styles.hint}
        />
      ) : null}
    </View>
  );

  if (isUser) return Inner;
  return <Pressable onPress={handlePress}>{Inner}</Pressable>;
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
  hint: {
    position: "absolute",
    bottom: 4,
    right: 8,
    fontSize: 11,
    color: "#9ca3af",
  },
});
