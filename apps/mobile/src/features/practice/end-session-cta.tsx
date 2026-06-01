// apps/mobile/src/features/practice/end-session-cta.tsx
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EditorialText, GlassCard } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";

type Props = {
  visible: boolean;
  onPress: () => void;
};

export function EndSessionCTA({ visible, onPress }: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 8,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="End conversation and see feedback"
      >
        <GlassCard radiusToken="pill" padding="sm" style={styles.pill}>
          <EditorialText kind="bodySm" color={palette.ink} style={styles.label}>
            End & see feedback
          </EditorialText>
          <Ionicons name="chevron-forward" size={14} color={palette.ink} />
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  label: {
    fontWeight: "600",
  },
});
