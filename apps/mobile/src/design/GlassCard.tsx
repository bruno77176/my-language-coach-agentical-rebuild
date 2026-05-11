import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { palette, radius, spacing } from "@language-coach/design-tokens";

type Props = {
  children: ReactNode;
  padding?: keyof typeof spacing;
  radiusToken?: keyof typeof radius;
  strong?: boolean;
  style?: ViewStyle;
};

export function GlassCard({
  children,
  padding = "base",
  radiusToken = "lg",
  strong = false,
  style,
}: Props) {
  const r = radius[radiusToken];
  const p = spacing[padding];
  const fallbackBg = strong ? palette.glassStrong : palette.glass;

  // No outer shadow / elevation — on Android, Material elevation casts a dark
  // grey shadow that traces the card's rounded rect and reads as a hard grey
  // rectangle on a warm gradient. The translucent BlurView surface is enough
  // to differentiate cards from the background.
  return (
    <BlurView
      intensity={strong ? 28 : 16}
      tint="light"
      style={[
        styles.inner,
        { borderRadius: r, padding: p, backgroundColor: fallbackBg },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  inner: { overflow: "hidden" },
});
