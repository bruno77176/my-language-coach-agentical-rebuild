import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

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

  return (
    <View style={[styles.shadow, { borderRadius: r }, style]}>
      {Platform.OS === "android" ? (
        <View
          style={[
            styles.inner,
            { borderRadius: r, padding: p, backgroundColor: fallbackBg },
          ]}
        >
          {children}
        </View>
      ) : (
        <BlurView
          intensity={strong ? 30 : 18}
          tint="light"
          style={[
            styles.inner,
            { borderRadius: r, padding: p, backgroundColor: fallbackBg },
          ]}
        >
          {children}
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { ...shadow.card },
  inner: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
});
