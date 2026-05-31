import { useState, type ComponentProps } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { palette, spacing } from "@language-coach/design-tokens";

/**
 * BottomSheet-aware sister of PasswordInput. Uses `BottomSheetTextInput`
 * internally so keyboard avoidance inside a bottom sheet still works.
 */
export function BottomSheetPasswordInput(
  props: Omit<ComponentProps<typeof BottomSheetTextInput>, "secureTextEntry">,
) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <BottomSheetTextInput
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
