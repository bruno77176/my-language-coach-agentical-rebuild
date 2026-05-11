import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Variant = "coach" | "you";

type Props = {
  variant: Variant;
  children: ReactNode;
  style?: ViewStyle;
};

export function Bubble({ variant, children, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === "coach" ? styles.coach : styles.you,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    maxWidth: "78%",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  coach: {
    alignSelf: "flex-start",
    backgroundColor: palette.glassStrong,
    borderTopLeftRadius: spacing.sm,
  },
  you: {
    alignSelf: "flex-end",
    backgroundColor: palette.ink,
    borderTopRightRadius: spacing.sm,
  },
});
