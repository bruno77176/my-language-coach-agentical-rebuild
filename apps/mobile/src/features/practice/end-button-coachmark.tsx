import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { EditorialText } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";

const SEEN_KEY = "coachmark.end-button.seen.v1";

export function EndButtonCoachmark() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY);
      if (cancelled || seen === "1") return;
      // Small delay so it appears after the screen has settled.
      setTimeout(() => {
        if (cancelled) return;
        setVisible(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }, 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, [opacity]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
    void AsyncStorage.setItem(SEEN_KEY, "1");
  };

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          // Sits below the TopStatusBar pill row (avatar/timer at top, ~44px).
          top: insets.top + spacing.sm + 44 + spacing.sm,
          right: spacing.lg,
          opacity,
        },
      ]}
    >
      {/* Arrow tail pointing up to the End pill */}
      <View style={styles.arrow} />
      <Pressable
        onPress={dismiss}
        accessibilityLabel="Dismiss tip"
        accessibilityRole="button"
        style={styles.card}
      >
        <EditorialText kind="bodySm" color={palette.cream} style={styles.text}>
          Tap{" "}
          <EditorialText kind="bodySm" color={palette.accent}>
            End ▸
          </EditorialText>{" "}
          when you&apos;re done with the conversation — that&apos;s how you get
          your feedback.
        </EditorialText>
        <Ionicons name="close" size={14} color={palette.cream} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    zIndex: 20,
    maxWidth: 260,
    alignItems: "flex-end",
  },
  arrow: {
    width: 0,
    height: 0,
    marginRight: 16,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: palette.ink,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  text: {
    flexShrink: 1,
    lineHeight: 18,
  },
});
