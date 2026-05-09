import { StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "./types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}
    >
      <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
        {message.text}
      </Text>
    </View>
  );
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
});
