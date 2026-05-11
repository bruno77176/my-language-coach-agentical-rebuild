import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { ViewStyle } from "react-native";
import { Animated } from "react-native";
import { motion } from "@language-coach/design-tokens";

type Props = {
  children: ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  fromY?: number;
};

export function FadeInView({
  children,
  duration = motion.duration.slow,
  delay = 0,
  style,
  fromY = 0,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration, delay]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
