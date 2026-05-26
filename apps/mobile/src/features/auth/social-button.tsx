import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { EditorialText } from "@/src/design";
import {
  palette,
  radius,
  spacing,
  shadow,
} from "@language-coach/design-tokens";

type Props = {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  variant: "google" | "apple";
};

export function SocialButton({
  label,
  onPress,
  busy,
  disabled,
  variant,
}: Props) {
  const isDark = variant === "apple";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={[
        styles.button,
        isDark ? styles.buttonDark : styles.buttonLight,
        (busy || disabled) && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator color={isDark ? palette.peach : palette.ink} />
        ) : null}
        <EditorialText
          kind="bodyLg"
          color={isDark ? palette.peach : palette.ink}
        >
          {label}
        </EditorialText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
  buttonLight: {
    backgroundColor: palette.peach,
    borderWidth: 1,
    borderColor: palette.glassFaint,
  },
  buttonDark: {
    backgroundColor: palette.ink,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  disabled: { opacity: 0.6 },
});
