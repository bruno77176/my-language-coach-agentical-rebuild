import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, spacing, touch } from "@language-coach/design-tokens";
import { EditorialText } from "@/src/design";

type Props = {
  label: string;
  value: string;
  onPress: () => void;
  /** Pass true on the last row of a section to suppress the bottom divider. */
  isLast?: boolean;
};

export function ProfileRow({ label, value, onPress, isLast = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, isLast ? null : styles.divider]}
    >
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        {label}
      </EditorialText>
      <View style={styles.rightCol}>
        <EditorialText kind="bodyMd" color={palette.ink}>
          {value}
        </EditorialText>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={palette.inkSoft}
          style={styles.chevron}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: touch.min,
    backgroundColor: "transparent",
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.glassFaint,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
