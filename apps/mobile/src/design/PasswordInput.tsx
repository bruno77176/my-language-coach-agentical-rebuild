import { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, spacing } from "@language-coach/design-tokens";

/**
 * TextInput pre-wired for passwords with a visibility toggle (eye icon).
 * Accepts the same props as TextInput — except `secureTextEntry`, which is
 * managed internally based on the toggle state.
 */
export function PasswordInput(props: Omit<TextInputProps, "secureTextEntry">) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <TextInput
        {...props}
        secureTextEntry={!visible}
        style={[props.style, styles.input]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        hitSlop={8}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={palette.inkSoft}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  input: { flex: 1 },
  toggle: { padding: spacing.xs, marginLeft: spacing.xs },
});
