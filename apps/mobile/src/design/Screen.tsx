import { ReactNode } from "react";
import { StatusBar, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, palette } from "@language-coach/design-tokens";

type Variant = "gradient" | "solid" | "ink";

type Props = {
  children: ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  /** When true, do not wrap in SafeAreaView (useful for modals that handle their own insets). */
  edgeToEdge?: boolean;
};

export function Screen({
  children,
  variant = "gradient",
  style,
  edgeToEdge = false,
}: Props) {
  const Container = edgeToEdge ? View : SafeAreaView;
  const isInk = variant === "ink";

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={isInk ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      {variant === "gradient" && (
        <>
          <LinearGradient
            colors={[...gradients.sunrise] as [string, string, string]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[...gradients.warmth] as [string, string]}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.7 }}
            style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          />
        </>
      )}
      {variant === "solid" && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.peach }]}
        />
      )}
      {variant === "ink" && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink }]}
        />
      )}
      <Container style={[styles.container, style]}>{children}</Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
});
