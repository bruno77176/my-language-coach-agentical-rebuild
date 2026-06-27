import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radius, spacing } from "@language-coach/design-tokens";

/**
 * "Type or talk" text input (BRU-45) — sits next to the mic so the user can
 * type a turn when they can't speak. Submitting runs the same turn pipeline.
 */
export function TextComposer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !disabled;

  const send = () => {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <View style={styles.row}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type a message…"
        placeholderTextColor={palette.inkSoft}
        style={styles.input}
        editable={!disabled}
        multiline
        onSubmitEditing={send}
        returnKeyType="send"
        blurOnSubmit
      />
      {canSend ? (
        <Pressable onPress={send} hitSlop={8} style={styles.send}>
          <Ionicons name="arrow-up" size={20} color={palette.peach} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 16,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
